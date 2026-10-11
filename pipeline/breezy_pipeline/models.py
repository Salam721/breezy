from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Reading:
    """One latest PM2.5 reading from one sensor (value in ug/m3)."""
    sensor_id: int
    location_id: int
    lat: float
    lon: float
    pm25: float
    observed_at: datetime  # timezone-aware UTC


@dataclass(frozen=True)
class Wind:
    """Wind as reported by OpenWeatherMap.

    from_deg: meteorological direction, i.e. the direction the wind comes FROM,
    degrees clockwise from north. (UNVERIFIED convention; confirmed by task T0.)
    speed_mps: metres per second (OpenWeatherMap's default unit).
    """
    from_deg: float
    speed_mps: float

    @property
    def speed_mph(self) -> float:
        return self.speed_mps * 2.2369362921
