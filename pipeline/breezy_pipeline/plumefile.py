"""R2.2 / design.md section 2: build the plumes.json document the app downloads."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List

from shapely.geometry import mapping

from .config import Config
from .models import Reading, Wind
from .plume import build_plume


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_plume_file(
    readings: Iterable[Reading], wind: Wind, cfg: Config, now: datetime
) -> Dict[str, Any]:
    """GeoJSON FeatureCollection with `generated_at`, `wind` and `config`.

    Only readings at or above the threshold produce a plume. An empty `features`
    list is a valid, fresh "no active plumes" file.
    """
    readings = list(readings)
    features: List[Dict[str, Any]] = []
    for r in readings:
        if r.pm25 < cfg.threshold_pm25:
            continue
        poly = build_plume(r.lat, r.lon, wind, cfg)
        geom = mapping(poly)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "sensor_id": r.sensor_id,
                    "location_id": r.location_id,
                    "pm25": r.pm25,
                    "observed_at": _iso(r.observed_at),
                },
                "geometry": {
                    "type": geom["type"],
                    "coordinates": [[list(c) for c in ring] for ring in geom["coordinates"]],
                },
            }
        )
    return {
        "type": "FeatureCollection",
        "generated_at": _iso(now),
        # Newest sensor reading behind this file. generated_at says when the file was built;
        # data_as_of says how old the underlying measurements are (T0: roughly hourly).
        "data_as_of": _iso(max(r.observed_at for r in readings)) if readings else None,
        "sensors_used": len(readings),
        "wind": {
            "from_deg": wind.from_deg,
            "speed_mph": round(wind.speed_mph, 2),
            "source": "openweathermap",
        },
        "config": {
            "threshold_pm25": cfg.threshold_pm25,
            "horizon_s": cfg.horizon_s,
            "half_angle_deg": cfg.half_angle_deg,
            "min_len_m": cfg.min_len_m,
            "model": "illustrative wedge, not a validated dispersion model",
        },
        "features": features,
    }


def to_json(doc: Dict[str, Any]) -> str:
    return json.dumps(doc, separators=(",", ":"))
