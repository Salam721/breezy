"""R1.2: drop dead sensors, negative values and impossible spikes."""
from __future__ import annotations

import math
from datetime import datetime, timedelta
from typing import Iterable, List, Optional

from .models import Reading


def reject_reason(
    r: Reading,
    now: datetime,
    max_pm25: float = 500.0,
    sensor_max_age_min: float = 120.0,
) -> Optional[str]:
    """None if the reading is trustworthy, otherwise a short reason it is dropped."""
    if r.pm25 is None or not math.isfinite(r.pm25):
        return "not a number"
    if r.pm25 < 0:
        return "negative value"
    if r.pm25 > max_pm25:
        return f"above {max_pm25:g}"
    if r.lat is None or r.lon is None or not (-90 <= r.lat <= 90 and -180 <= r.lon <= 180):
        return "bad coordinates"
    if r.observed_at > now + timedelta(minutes=5):
        return "timestamp in the future"
    if r.observed_at < now - timedelta(minutes=sensor_max_age_min):
        return f"dead sensor (older than {sensor_max_age_min:g} min)"
    return None


def sanitize(
    readings: Iterable[Reading],
    now: datetime,
    max_pm25: float = 500.0,
    sensor_max_age_min: float = 120.0,
) -> List[Reading]:
    """Return only trustworthy readings (see `reject_reason`)."""
    return [r for r in readings if reject_reason(r, now, max_pm25, sensor_max_age_min) is None]
