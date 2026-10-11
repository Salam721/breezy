import json
import os
from datetime import datetime, timedelta, timezone

import pytest

from breezy_pipeline import openaq, weather
from breezy_pipeline.config import Config
from breezy_pipeline.handler import NoDataError, run_cycle
from breezy_pipeline.http import ApiError, redact
from breezy_pipeline.models import Wind
from breezy_pipeline.publish import publish_local, publish_s3
from breezy_pipeline.run_local import load_dotenv

NOW = datetime(2026, 10, 10, 22, 30, tzinfo=timezone.utc)


def iso(minutes_ago):
    return (NOW - timedelta(minutes=minutes_ago)).strftime("%Y-%m-%dT%H:%M:%SZ")


def loc(id_, lat, lon, sensors):
    return {
        "id": id_,
        "coordinates": {"latitude": lat, "longitude": lon},
        "sensors": [{"id": sid, "parameter": {"id": pid, "name": name}} for sid, pid, name in sensors],
    }


LOCATIONS = {
    "meta": {"found": 3, "limit": 1000, "page": 1},
    "results": [
        loc(1, 33.75, -84.40, [(11, 2, "pm25"), (12, 7, "no2")]),
        loc(2, 33.80, -84.35, [(21, 2, "pm25")]),
        loc(3, 33.70, -84.45, [(31, 7, "no2")]),  # no PM2.5: must be ignored
    ],
}


def latest(location_id, entries):
    return {
        "results": [
            {"datetime": {"utc": iso(m)}, "value": v, "sensorsId": sid, "locationsId": location_id,
             "coordinates": {"latitude": 33.75, "longitude": -84.40}}
            for sid, v, m in entries
        ]
    }


WEATHER = {"wind": {"speed": 4.0, "deg": 270}}


def make_http(overrides=None, calls=None):
    table = {
        "/v3/locations?": LOCATIONS,
        "/v3/locations/1/latest": latest(1, [(11, 80.0, 5), (12, 99.0, 5)]),  # 12 is no2: ignored
        "/v3/locations/2/latest": latest(2, [(21, 12.0, 5)]),
        "api.openweathermap.org": WEATHER,
    }
    table.update(overrides or {})

    def http_get(url, headers):
        if calls is not None:
            calls.append((url, dict(headers)))
        for key, val in table.items():
            if key in url:
                if isinstance(val, Exception):
                    raise val
                return val
        raise AssertionError(f"unexpected url {redact(url)}")

    return http_get


CFG = Config(openaq_api_key="OPENAQ-SECRET", owm_api_key="OWM-SECRET")


# ---- parsing ----------------------------------------------------------------
def test_parse_locations_keeps_only_pm25_locations():
    locs = openaq.parse_locations(LOCATIONS)
    assert [l.id for l in locs] == [1, 2]
    assert locs[0].pm25_sensor_ids == frozenset({11})


def test_parse_latest_only_pm25_sensors():
    l = openaq.parse_locations(LOCATIONS)[0]
    readings = openaq.parse_latest(latest(1, [(11, 80.0, 5), (12, 99.0, 5)]), l)
    assert [(r.sensor_id, r.pm25) for r in readings] == [(11, 80.0)]
    assert readings[0].observed_at.tzinfo is not None


def test_parse_dt_variants():
    assert openaq.parse_dt({"utc": "2026-10-10T22:25:00Z"}) == NOW - timedelta(minutes=5)
    assert openaq.parse_dt("2026-10-10T22:25:00+00:00") == NOW - timedelta(minutes=5)
    assert openaq.parse_dt(None) is None
    assert openaq.parse_dt("garbage") is None


def test_parse_wind_and_missing_direction():
    w = weather.parse_wind({"wind": {"speed": 3.0, "deg": 450}})
    assert (w.from_deg, w.speed_mps) == (90.0, 3.0)
    assert weather.parse_wind({"wind": {"speed": 0}}).speed_mps == 0
    with pytest.raises(ApiError):
        weather.parse_wind({"wind": {"speed": 3.0}})
    with pytest.raises(ApiError):
        weather.parse_wind({})


# ---- requests -----------------------------------------------------------------
def test_locations_request_uses_bbox_order_and_key_header():
    calls = []
    openaq.fetch_pm25_locations(CFG, make_http(calls=calls))
    url, headers = calls[0]
    assert "bbox=-84.55,33.65,-84.29,33.89" in url  # min_lon,min_lat,max_lon,max_lat
    assert "limit=1000" in url
    assert headers["X-API-Key"] == "OPENAQ-SECRET"


def test_pagination_follows_found():
    page1 = {"meta": {"found": 1001}, "results": [loc(i, 33.7, -84.4, [(i * 10, 2, "pm25")]) for i in range(1000)]}
    page2 = {"meta": {"found": 1001}, "results": [loc(5000, 33.7, -84.4, [(50000, 2, "pm25")])]}
    seen = []

    def http_get(url, headers):
        seen.append(url)
        return page1 if "page=1" in url else page2

    out = openaq.fetch_pm25_locations(CFG, http_get)
    assert len(out) == 1001 and len(seen) == 2


# ---- full cycle -----------------------------------------------------------------
def test_cycle_builds_file_from_good_data():
    doc = run_cycle(CFG, make_http(), now=NOW)
    assert doc["generated_at"] == "2026-10-10T22:30:00Z"
    assert [f["properties"]["sensor_id"] for f in doc["features"]] == [11]  # 80 >= 35.5; 12 below
    assert doc["wind"]["from_deg"] == 270


def test_cycle_weather_failure_publishes_nothing():
    with pytest.raises(ApiError):
        run_cycle(CFG, make_http({"api.openweathermap.org": ApiError("boom")}), now=NOW)


def test_cycle_latest_failure_publishes_nothing():
    with pytest.raises(ApiError):
        run_cycle(CFG, make_http({"/v3/locations/2/latest": ApiError("boom")}), now=NOW)


def test_cycle_no_valid_data_raises_nodata():
    stale = {"/v3/locations/1/latest": latest(1, [(11, 80.0, 500)]),
             "/v3/locations/2/latest": latest(2, [(21, 12.0, 500)])}
    with pytest.raises(NoDataError):
        run_cycle(CFG, make_http(stale), now=NOW)


def test_cycle_all_sanitized_away_raises_nodata():
    bad = {"/v3/locations/1/latest": latest(1, [(11, -5.0, 5)]),
           "/v3/locations/2/latest": latest(2, [(21, 900.0, 5)])}
    with pytest.raises(NoDataError):
        run_cycle(CFG, make_http(bad), now=NOW)


def test_cycle_caps_locations(caplog):
    cfg = Config(openaq_api_key="k", owm_api_key="k", max_locations=1)
    calls = []
    run_cycle(cfg, make_http(calls=calls), now=NOW)
    latest_calls = [c for c in calls if "/latest" in c[0]]
    assert len(latest_calls) == 1


# ---- secrets, publishing, dotenv --------------------------------------------------
def test_redact_removes_weather_key():
    assert "OWM-SECRET" not in redact("https://x/y?lat=1&appid=OWM-SECRET&units=metric")


def test_publish_s3_uses_content_type_and_cache_control():
    sent = {}

    class FakeS3:
        def put_object(self, **kw):
            sent.update(kw)

    cfg = Config(s3_bucket="my-bucket", s3_key="plumes.json")
    publish_s3(cfg, '{"a":1}', client=FakeS3())
    assert sent["Bucket"] == "my-bucket" and sent["Key"] == "plumes.json"
    assert sent["ContentType"] == "application/json"
    assert sent["CacheControl"] == "max-age=30"
    assert sent["Body"] == b'{"a":1}'


def test_publish_s3_requires_bucket():
    with pytest.raises(ValueError):
        publish_s3(Config(), "{}", client=object())


def test_publish_local_atomic(tmp_path):
    target = tmp_path / "plumes.json"
    publish_local(str(target), '{"x":1}')
    assert json.loads(target.read_text()) == {"x": 1}
    assert [p.name for p in tmp_path.iterdir()] == ["plumes.json"]  # no temp file left


def test_load_dotenv(tmp_path, monkeypatch):
    f = tmp_path / ".env"
    f.write_text('# comment\nOPENAQ_API_KEY="abc"\nOPENWEATHER_API_KEY=def\n\nBAD LINE\n')
    monkeypatch.delenv("OPENAQ_API_KEY", raising=False)
    monkeypatch.setenv("OPENWEATHER_API_KEY", "already-set")
    loaded = load_dotenv(str(f))
    assert os.environ["OPENAQ_API_KEY"] == "abc"
    assert os.environ["OPENWEATHER_API_KEY"] == "already-set"  # env wins
    assert "OPENWEATHER_API_KEY" not in loaded
    monkeypatch.delenv("OPENAQ_API_KEY", raising=False)


def test_config_from_env_bbox(monkeypatch):
    monkeypatch.setenv("BREEZY_BBOX", "-85,33,-84,34")
    assert Config.from_env().bbox == (-85.0, 33.0, -84.0, 34.0)
    monkeypatch.setenv("BREEZY_BBOX", "1,2,3")
    with pytest.raises(ValueError):
        Config.from_env()
