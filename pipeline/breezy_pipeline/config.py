"""Configuration. Every plume-model number is an ASSUMPTION (see design.md 3.3),
exposed here so it can be changed without touching code. Secrets come from the
environment only; nothing secret is stored in the repo."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Tuple

# Placeholder box around Atlanta (min_lon, min_lat, max_lon, max_lat).
# ASSUMPTION: approximate; confirm it returns PM2.5 sensors with `check` (task T0).
DEFAULT_BBOX: Tuple[float, float, float, float] = (-84.55, 33.65, -84.29, 33.89)


def _f(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


@dataclass(frozen=True)
class Config:
    # Area. OpenAQ bbox order is min lon, min lat, max lon, max lat (verified in docs).
    bbox: Tuple[float, float, float, float] = DEFAULT_BBOX

    # Sanitizing (R1.2)
    max_pm25: float = 500.0            # from the brief (FR-1.2)
    # ASSUMPTION: what "dead sensor" means; owner to confirm. T0 showed Atlanta sensors
    # reporting about hourly (newest readings were ~58 min old), so 60 would drop live sensors.
    sensor_max_age_min: float = 120.0

    # Plume model (R2.1), ASSUMPTIONS except the threshold's EPA source
    threshold_pm25: float = 35.5       # EPA "Unhealthy for Sensitive Groups" lower bound (24 h band)
    horizon_s: float = 600.0           # ASSUMPTION
    half_angle_deg: float = 30.0       # ASSUMPTION
    min_len_m: float = 300.0           # ASSUMPTION
    calm_mps: float = 0.5              # ASSUMPTION
    arc_points: int = 8                # smoothness only

    # API budget (OpenAQ free tier: 60/min, 2000/h; verified in docs)
    max_locations: int = 50
    workers: int = 5

    # Secrets and output, from the environment
    openaq_api_key: str = field(default="", repr=False)
    owm_api_key: str = field(default="", repr=False)
    s3_bucket: str = ""
    s3_key: str = "plumes.json"
    cache_control: str = "max-age=30"

    @staticmethod
    def from_env() -> "Config":
        bbox = DEFAULT_BBOX
        raw = os.environ.get("BREEZY_BBOX")
        if raw:
            parts = tuple(float(p) for p in raw.split(","))
            if len(parts) != 4:
                raise ValueError("BREEZY_BBOX must be 'min_lon,min_lat,max_lon,max_lat'")
            bbox = parts  # type: ignore[assignment]
        return Config(
            bbox=bbox,
            max_pm25=_f("BREEZY_MAX_PM25", 500.0),
            sensor_max_age_min=_f("BREEZY_SENSOR_MAX_AGE_MIN", 120.0),
            threshold_pm25=_f("BREEZY_THRESHOLD_PM25", 35.5),
            horizon_s=_f("BREEZY_HORIZON_S", 600.0),
            half_angle_deg=_f("BREEZY_HALF_ANGLE_DEG", 30.0),
            min_len_m=_f("BREEZY_MIN_LEN_M", 300.0),
            calm_mps=_f("BREEZY_CALM_MPS", 0.5),
            max_locations=int(_f("BREEZY_MAX_LOCATIONS", 50)),
            openaq_api_key=os.environ.get("OPENAQ_API_KEY", ""),
            owm_api_key=os.environ.get("OPENWEATHER_API_KEY", ""),
            s3_bucket=os.environ.get("BREEZY_S3_BUCKET", ""),
            s3_key=os.environ.get("BREEZY_S3_KEY", "plumes.json"),
            cache_control=os.environ.get("BREEZY_CACHE_CONTROL", "max-age=30"),
        )

    @property
    def center(self) -> Tuple[float, float]:
        """(lat, lon) of the bbox center, where wind is sampled (one vector per cycle)."""
        min_lon, min_lat, max_lon, max_lat = self.bbox
        return ((min_lat + max_lat) / 2.0, (min_lon + max_lon) / 2.0)
