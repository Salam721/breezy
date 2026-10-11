"""Run the pipeline on your own machine.

    python -m breezy_pipeline.run_local check           # task T0: confirm APIs, sensors and wind
    python -m breezy_pipeline.run_local once --out plumes.json
    python -m breezy_pipeline.run_local loop --out plumes.json     # every 5 minutes
    python -m breezy_pipeline.run_local once --s3                  # publish to S3 (needs AWS creds)

Keys are read from the environment or from a `.env` file (see .env.example).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Dict, Optional

from .config import Config
from .handler import NoDataError, run_cycle
from .http import ApiError, default_http_get
from .openaq import fetch_latest, fetch_pm25_locations
from .plumefile import to_json
from .publish import publish_local, publish_s3
from .sanitize import reject_reason, sanitize
from .weather import fetch_wind


def load_dotenv(path: str) -> Dict[str, str]:
    """Minimal .env reader: KEY=VALUE lines, '#' comments. Existing env vars win."""
    loaded: Dict[str, str] = {}
    if not os.path.exists(path):
        return loaded
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v
                loaded[k] = v
    return loaded


def check(cfg: Config) -> int:
    """Task T0. Prints facts only; never prints keys."""
    problems = 0
    if not cfg.openaq_api_key:
        print("MISSING: OPENAQ_API_KEY"); problems += 1
    if not cfg.owm_api_key:
        print("MISSING: OPENWEATHER_API_KEY"); problems += 1
    if problems:
        return 1
    print(f"bbox (min_lon,min_lat,max_lon,max_lat): {cfg.bbox}")

    try:
        locations = fetch_pm25_locations(cfg, default_http_get)
    except ApiError as e:
        print(f"OpenAQ locations call FAILED: {e}")
        return 1
    n = len(locations)
    print(f"PM2.5 locations in bbox: {n}")
    print(f"API calls per cycle = 1 (locations) + {min(n, cfg.max_locations)} (latest) + 1 (weather)")
    if n > cfg.max_locations:
        print(f"WARNING: more than {cfg.max_locations}; the pipeline will only use the first {cfg.max_locations}")
    if n == 0:
        print("No PM2.5 sensors found. Widen the bbox (BREEZY_BBOX) or tell Claude.")

    now = datetime.now(timezone.utc)
    raw = []
    for loc in locations[: cfg.max_locations]:
        try:
            got = fetch_latest(cfg, loc, default_http_get)
        except ApiError as e:
            print(f"latest call failed for location {loc.id}: {e}")
            continue
        if not got:
            print(f"  location {loc.id} @({loc.lat:.4f},{loc.lon:.4f}): no PM2.5 reading returned")
        raw.extend(got)
    good = sanitize(raw, now, cfg.max_pm25, cfg.sensor_max_age_min)
    print(f"readings: {len(raw)} raw, {len(good)} after sanitizing (dead-sensor age limit {cfg.sensor_max_age_min:g} min)")
    for r in raw:
        why = reject_reason(r, now, cfg.max_pm25, cfg.sensor_max_age_min)
        age = (now - r.observed_at).total_seconds() / 60
        print(f"  sensor {r.sensor_id}: pm25={r.pm25} age={age:.0f} min -> {'kept' if why is None else 'DROPPED: ' + why}")
    above = [r for r in good if r.pm25 >= cfg.threshold_pm25]
    print(f"readings at/above threshold {cfg.threshold_pm25}: {len(above)}")

    try:
        wind = fetch_wind(cfg, default_http_get)
        print(f"wind at bbox center: from {wind.from_deg} deg, {wind.speed_mps} m/s ({wind.speed_mph:.1f} mph)")
        print("Compare this with a trusted wind report for Atlanta right now.")
        print("If the report's 'from' direction differs by ~180 deg, tell Claude: the convention is flipped.")
    except ApiError as e:
        print(f"OpenWeatherMap call FAILED: {e}")
        return 1
    return 0 if n > 0 else 2


def once(cfg: Config, out: Optional[str], to_s3: bool) -> int:
    try:
        doc = run_cycle(cfg)
    except NoDataError as e:
        print(f"{datetime.now(timezone.utc).isoformat()} NOT PUBLISHED: {e}")
        return 2
    except ApiError as e:
        print(f"{datetime.now(timezone.utc).isoformat()} NOT PUBLISHED (API error): {e}")
        return 1
    body = to_json(doc)
    if out:
        publish_local(out, body)
    if to_s3:
        publish_s3(cfg, body)
    print(f"{doc['generated_at']} published: {len(doc['features'])} plume(s)"
          + (f" -> {out}" if out else "") + (" -> S3" if to_s3 else ""))
    return 0


def main(argv: Optional[list] = None) -> int:
    p = argparse.ArgumentParser(prog="breezy_pipeline.run_local")
    p.add_argument("command", choices=["check", "once", "loop"])
    p.add_argument("--out", help="write plumes.json to this local path")
    p.add_argument("--s3", action="store_true", help="also publish to S3 (BREEZY_S3_BUCKET)")
    p.add_argument("--interval", type=int, default=300, help="seconds between cycles in loop mode (default 300)")
    args = p.parse_args(argv)

    for candidate in (".env", os.path.join("..", ".env")):
        load_dotenv(candidate)
    cfg = Config.from_env()

    if args.command == "check":
        return check(cfg)
    if not (args.out or args.s3):
        print("Choose an output: --out FILE and/or --s3")
        return 1
    if args.command == "once":
        return once(cfg, args.out, args.s3)
    while True:  # loop
        once(cfg, args.out, args.s3)
        time.sleep(args.interval)


if __name__ == "__main__":
    sys.exit(main())
