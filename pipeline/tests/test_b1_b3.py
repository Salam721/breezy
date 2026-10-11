import json
import math
from datetime import datetime, timedelta, timezone

import pytest
from shapely.geometry import Point

from breezy_pipeline.config import Config
from breezy_pipeline.models import Reading, Wind
from breezy_pipeline.plume import M_PER_DEG, build_plume, cone_length_m, downwind_bearing
from breezy_pipeline.plumefile import build_plume_file, to_json
from breezy_pipeline.sanitize import reject_reason, sanitize

NOW = datetime(2026, 10, 10, 22, 30, tzinfo=timezone.utc)
CFG = Config()
LAT, LON = 33.75, -84.39


def reading(pm25=50.0, age_min=5, lat=LAT, lon=LON, sid=1):
    return Reading(sid, 10, lat, lon, pm25, NOW - timedelta(minutes=age_min))


def east(dist_m, lat=LAT, lon=LON):
    return Point(lon + dist_m / (M_PER_DEG * math.cos(math.radians(lat))), lat)


def north(dist_m, lat=LAT, lon=LON):
    return Point(lon, lat + dist_m / M_PER_DEG)


# ---- B1 sanitize ----------------------------------------------------------
def test_sanitize_keeps_good_reading():
    assert sanitize([reading(40)], NOW) == [reading(40)]


def test_sanitize_drops_negative_and_over_500():
    out = sanitize([reading(-1, sid=1), reading(501, sid=2), reading(500, sid=3), reading(0, sid=4)], NOW)
    assert [r.sensor_id for r in out] == [3, 4]


def test_sanitize_drops_nan_and_inf():
    out = sanitize([reading(float("nan"), sid=1), reading(float("inf"), sid=2)], NOW)
    assert out == []


def test_sanitize_drops_dead_sensor_with_explicit_limit():
    out = sanitize([reading(40, age_min=61, sid=1), reading(40, age_min=59, sid=2)], NOW, sensor_max_age_min=60)
    assert [r.sensor_id for r in out] == [2]


def test_default_age_limit_keeps_hourly_sensors():
    # T0 on the Atlanta box: live sensors reported readings about 58 min old.
    out = sanitize([reading(40, age_min=58, sid=1), reading(40, age_min=119, sid=2), reading(40, age_min=121, sid=3)], NOW)
    assert [r.sensor_id for r in out] == [1, 2]


def test_reject_reason_labels():
    assert reject_reason(reading(40), NOW) is None
    assert reject_reason(reading(-1), NOW) == "negative value"
    assert reject_reason(reading(501), NOW) == "above 500"
    assert reject_reason(reading(float("nan")), NOW) == "not a number"
    assert reject_reason(reading(40, age_min=500), NOW).startswith("dead sensor")
    assert reject_reason(reading(40, lat=95.0), NOW) == "bad coordinates"


def test_sanitize_drops_future_timestamp():
    r = Reading(1, 1, LAT, LON, 40.0, NOW + timedelta(hours=2))
    assert sanitize([r], NOW) == []


def test_sanitize_drops_bad_coordinates():
    assert sanitize([reading(40, lat=95.0)], NOW) == []
    assert sanitize([reading(40, lon=-200.0)], NOW) == []


# ---- B2 geometry ----------------------------------------------------------
def test_downwind_bearing():
    assert downwind_bearing(270) == 90   # wind from the west blows east
    assert downwind_bearing(0) == 180
    assert downwind_bearing(180) == 0
    assert downwind_bearing(90) == 270


def test_cone_points_downwind_west_wind():
    poly = build_plume(LAT, LON, Wind(from_deg=270, speed_mps=5), CFG)
    assert poly.is_valid
    assert poly.contains(east(1000))          # downwind (east) is inside
    assert not poly.contains(east(-1000))     # upwind (west) is outside


def test_cone_points_downwind_north_wind():
    # wind from the north blows south
    poly = build_plume(LAT, LON, Wind(from_deg=0, speed_mps=5), CFG)
    assert poly.contains(north(-1000))
    assert not poly.contains(north(1000))


def test_apex_at_sensor():
    poly = build_plume(LAT, LON, Wind(270, 5), CFG)
    coords = list(poly.exterior.coords)
    assert any(abs(x - LON) < 1e-9 and abs(y - LAT) < 1e-9 for x, y in coords)


def test_length_follows_speed_with_floor():
    assert cone_length_m(5, CFG) == pytest.approx(3000)   # 5 m/s * 600 s
    assert cone_length_m(0.6, CFG) == pytest.approx(360)  # 0.6 * 600
    assert cone_length_m(0.5, CFG) == pytest.approx(300)  # floor 300 (0.5*600=300)


def test_cone_reach_matches_length():
    poly = build_plume(LAT, LON, Wind(270, 5), CFG)
    assert poly.contains(east(2900))
    assert not poly.contains(east(3100))


def test_cone_spread_limits():
    poly = build_plume(LAT, LON, Wind(270, 5), CFG)
    # 1000 m downwind, 100 m off axis: angle ~5.7 deg < 30 deg -> inside
    p_in = Point(east(1000).x, LAT + 100 / M_PER_DEG)
    # 1000 m downwind, 800 m off axis: angle ~38.7 deg > 30 deg -> outside
    p_out = Point(east(1000).x, LAT + 800 / M_PER_DEG)
    assert poly.contains(p_in)
    assert not poly.contains(p_out)


def test_calm_wind_gives_circle_around_sensor():
    poly = build_plume(LAT, LON, Wind(from_deg=123, speed_mps=0.1), CFG)
    assert poly.is_valid
    for d in (east(200), east(-200), north(200), north(-200)):
        assert poly.contains(d)
    assert not poly.contains(east(500))


def test_polygon_is_counter_clockwise_and_closed():
    poly = build_plume(LAT, LON, Wind(270, 5), CFG)
    assert poly.exterior.is_ccw
    c = list(poly.exterior.coords)
    assert c[0] == c[-1]


# ---- B3 plume file --------------------------------------------------------
def test_plume_file_shape_and_threshold():
    readings = [reading(60, sid=1), reading(35.4, sid=2), reading(35.5, sid=3)]
    doc = build_plume_file(readings, Wind(270, 3.0), CFG, NOW)
    assert doc["type"] == "FeatureCollection"
    assert doc["generated_at"] == "2026-10-10T22:30:00Z"
    ids = [f["properties"]["sensor_id"] for f in doc["features"]]
    assert ids == [1, 3]  # 35.4 is below threshold, 35.5 is at it
    assert doc["wind"]["from_deg"] == 270
    assert doc["wind"]["speed_mph"] == pytest.approx(6.71, abs=0.01)
    assert doc["config"]["threshold_pm25"] == 35.5
    f = doc["features"][0]
    assert f["geometry"]["type"] == "Polygon"
    ring = f["geometry"]["coordinates"][0]
    assert ring[0] == ring[-1]
    assert all(len(pt) == 2 for pt in ring)
    lon, lat = ring[0]
    assert -90 <= lat <= 90 and -180 <= lon <= 180
    assert lon < 0  # longitude first (Atlanta is west of Greenwich)


def test_plume_file_empty_is_valid_and_fresh():
    doc = build_plume_file([], Wind(270, 3.0), CFG, NOW)
    assert doc["features"] == []
    assert doc["generated_at"] == "2026-10-10T22:30:00Z"
    assert doc["data_as_of"] is None and doc["sensors_used"] == 0


def test_plume_file_reports_data_age_separately_from_build_time():
    readings = [reading(10, age_min=58, sid=1), reading(10, age_min=30, sid=2)]
    doc = build_plume_file(readings, Wind(270, 3.0), CFG, NOW)
    assert doc["generated_at"] == "2026-10-10T22:30:00Z"
    assert doc["data_as_of"] == "2026-10-10T22:00:00Z"   # newest reading, 30 min old
    assert doc["sensors_used"] == 2


def test_plume_file_json_round_trip():
    doc = build_plume_file([reading(60)], Wind(270, 3.0), CFG, NOW)
    assert json.loads(to_json(doc)) == doc
