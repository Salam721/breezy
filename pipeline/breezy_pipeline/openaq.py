"""OpenAQ v3 client (R1.1).

Endpoints and fields follow the OpenAQ docs read on 2026-10-10:
- GET /v3/locations?bbox=minLon,minLat,maxLon,maxLat&limit=&page=   (meta.found = total)
- GET /v3/locations/{id}/latest   -> results[{datetime{utc}, value, sensorsId, locationsId, coordinates}]
- PM2.5 is parameter id 2 (name "pm25", unit ug/m3); header `X-API-Key`.
Response parsing is UNVERIFIED against a live call until task T0 is run.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from .config import Config
from .http import ApiError, HttpGet
from .models import Reading

BASE = "https://api.openaq.org/v3"
PM25_NAME = "pm25"
PM25_PARAMETER_ID = 2
PAGE_LIMIT = 1000  # documented maximum
MAX_PAGES = 10


@dataclass(frozen=True)
class Location:
    id: int
    lat: float
    lon: float
    pm25_sensor_ids: frozenset


def _headers(cfg: Config) -> Dict[str, str]:
    return {"X-API-Key": cfg.openaq_api_key, "Accept": "application/json"}


def parse_dt(value: Any) -> Optional[datetime]:
    """Accepts {'utc': '...Z', 'local': '...'} or a plain ISO string. Returns aware UTC."""
    if isinstance(value, dict):
        value = value.get("utc")
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def parse_locations(payload: Dict[str, Any]) -> List[Location]:
    """Keep only locations that have at least one PM2.5 sensor (filtered client-side)."""
    out: List[Location] = []
    for res in payload.get("results", []) or []:
        coords = res.get("coordinates") or {}
        lat, lon = coords.get("latitude"), coords.get("longitude")
        if lat is None or lon is None:
            continue
        ids: Set[int] = set()
        for s in res.get("sensors", []) or []:
            p = s.get("parameter") or {}
            if p.get("name") == PM25_NAME or p.get("id") == PM25_PARAMETER_ID:
                if s.get("id") is not None:
                    ids.add(int(s["id"]))
        if ids and res.get("id") is not None:
            out.append(Location(int(res["id"]), float(lat), float(lon), frozenset(ids)))
    return out


def fetch_pm25_locations(cfg: Config, http_get: HttpGet) -> List[Location]:
    min_lon, min_lat, max_lon, max_lat = cfg.bbox
    bbox = f"{min_lon},{min_lat},{max_lon},{max_lat}"
    found_locations: List[Location] = []
    seen = 0
    for page in range(1, MAX_PAGES + 1):
        url = f"{BASE}/locations?bbox={bbox}&limit={PAGE_LIMIT}&page={page}"
        payload = http_get(url, _headers(cfg))
        results = payload.get("results", []) or []
        seen += len(results)
        found_locations.extend(parse_locations(payload))
        total = (payload.get("meta") or {}).get("found")
        # `found` can be a number or a string like ">1000" in some APIs; only trust ints.
        if not results or (isinstance(total, int) and seen >= total) or len(results) < PAGE_LIMIT:
            break
    return found_locations


def parse_latest(payload: Dict[str, Any], location: Location) -> List[Reading]:
    out: List[Reading] = []
    for res in payload.get("results", []) or []:
        sid = res.get("sensorsId")
        if sid is None or int(sid) not in location.pm25_sensor_ids:
            continue
        value = res.get("value")
        when = parse_dt(res.get("datetime"))
        if value is None or when is None:
            continue
        coords = res.get("coordinates") or {}
        lat = coords.get("latitude", location.lat)
        lon = coords.get("longitude", location.lon)
        out.append(Reading(int(sid), location.id, float(lat), float(lon), float(value), when))
    return out


def fetch_latest(cfg: Config, location: Location, http_get: HttpGet) -> List[Reading]:
    payload = http_get(f"{BASE}/locations/{location.id}/latest", _headers(cfg))
    return parse_latest(payload, location)


__all__ = [
    "ApiError", "Location", "fetch_pm25_locations", "fetch_latest",
    "parse_locations", "parse_latest", "parse_dt",
]
