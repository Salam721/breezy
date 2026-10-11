"""R2.1: directional plume polygon (design.md 3.3).

This is an ILLUSTRATIVE geometric model, not a validated dispersion model.
Length and spread are configurable assumptions.
"""
from __future__ import annotations

import math
from typing import List, Tuple

from shapely.geometry import Polygon
from shapely.geometry.polygon import orient

from .config import Config
from .models import Wind

# Approximate metres per degree of latitude, used for a small-area flat
# approximation. Rough, but small relative to the cone size.
M_PER_DEG = 111_320.0


def downwind_bearing(wind_from_deg: float) -> float:
    """Compass bearing (deg clockwise from north) the wind blows TOWARD."""
    return (wind_from_deg + 180.0) % 360.0


def _offset(lat: float, lon: float, bearing_deg: float, dist_m: float) -> Tuple[float, float]:
    """(lon, lat) reached from (lat, lon) going dist_m along a compass bearing."""
    b = math.radians(bearing_deg)
    dx = dist_m * math.sin(b)  # east
    dy = dist_m * math.cos(b)  # north
    new_lat = lat + dy / M_PER_DEG
    new_lon = lon + dx / (M_PER_DEG * math.cos(math.radians(lat)))
    return (new_lon, new_lat)


def cone_length_m(speed_mps: float, cfg: Config) -> float:
    return max(cfg.min_len_m, speed_mps * cfg.horizon_s)


def build_plume(lat: float, lon: float, wind: Wind, cfg: Config) -> Polygon:
    """Plume polygon for a sensor at (lat, lon).

    - Calm wind (direction unreliable): a circle of radius `min_len_m`.
    - Otherwise: a wedge with its apex at the sensor, opening downwind with
      half-angle `half_angle_deg` and length max(min_len_m, speed * horizon).
    Returned in (lon, lat) order, counter-clockwise exterior (RFC 7946).
    """
    if wind.speed_mps < cfg.calm_mps:
        n = max(16, cfg.arc_points * 2)
        pts: List[Tuple[float, float]] = [
            _offset(lat, lon, 360.0 * i / n, cfg.min_len_m) for i in range(n)
        ]
    else:
        bearing = downwind_bearing(wind.from_deg)
        length = cone_length_m(wind.speed_mps, cfg)
        n = cfg.arc_points
        pts = [(lon, lat)]
        for i in range(n + 1):
            b = bearing - cfg.half_angle_deg + (2.0 * cfg.half_angle_deg) * i / n
            pts.append(_offset(lat, lon, b, length))
    poly = Polygon(pts)
    if not poly.is_valid:
        poly = poly.buffer(0)
    return orient(poly, 1.0)
