"""One pipeline cycle (design.md 3.1) and the AWS Lambda entry point.

Failure policy (R1.4): if ANY step fails, nothing is published. The previous
file stays in place, so its `generated_at` ages and the app shows
"Stale/Unverified" instead of a false "safe".
Also [derived]: if no valid reading survives sanitizing, nothing is published,
because an empty "fresh" file would claim "no plumes" without any data.
"""
from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from .config import Config
from .http import ApiError, HttpGet, default_http_get
from .models import Reading, Wind
from .openaq import fetch_latest, fetch_pm25_locations
from .plumefile import build_plume_file, to_json
from .sanitize import sanitize
from .weather import fetch_wind

log = logging.getLogger("breezy")


class NoDataError(Exception):
    """No usable sensor data this cycle; do not publish."""


def run_cycle(
    cfg: Config,
    http_get: HttpGet = default_http_get,
    now: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Run extract -> transform -> load and return the plume file document."""
    now = now or datetime.now(timezone.utc)
    with ThreadPoolExecutor(max_workers=max(2, cfg.workers)) as pool:
        # Wind is queried concurrently with the sensor extraction (FR-1.3).
        wind_future = pool.submit(fetch_wind, cfg, http_get)
        locations = fetch_pm25_locations(cfg, http_get)
        if len(locations) > cfg.max_locations:
            log.warning(
                "%d PM2.5 locations in bbox; using the first %d to stay inside the API rate limit",
                len(locations), cfg.max_locations,
            )
            locations = locations[: cfg.max_locations]
        batches: List[List[Reading]] = list(
            pool.map(lambda loc: fetch_latest(cfg, loc, http_get), locations)
        )
        wind: Wind = wind_future.result()

    raw = [r for batch in batches for r in batch]
    good = sanitize(raw, now, cfg.max_pm25, cfg.sensor_max_age_min)
    if not good:
        raise NoDataError(f"no valid PM2.5 readings ({len(raw)} raw, {len(locations)} locations)")
    return build_plume_file(good, wind, cfg, now)


def lambda_handler(event: Any = None, context: Any = None) -> Dict[str, Any]:
    from .publish import publish_s3  # local import keeps module import light

    cfg = Config.from_env()
    doc = run_cycle(cfg)
    publish_s3(cfg, to_json(doc))
    return {"published": True, "generated_at": doc["generated_at"], "plumes": len(doc["features"])}
