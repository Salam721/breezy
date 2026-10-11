"""OpenWeatherMap current-weather client (R1.3).

GET https://api.openweathermap.org/data/2.5/weather?lat&lon&appid
`wind.speed` is m/s by default; `wind.deg` is "meteorological" (assumed: the
direction the wind comes FROM). The convention is UNVERIFIED until task T0.
"""
from __future__ import annotations

from typing import Any, Dict

from .config import Config
from .http import ApiError, HttpGet
from .models import Wind

URL = "https://api.openweathermap.org/data/2.5/weather"


def parse_wind(payload: Dict[str, Any]) -> Wind:
    wind = payload.get("wind")
    if not isinstance(wind, dict) or wind.get("speed") is None:
        raise ApiError("weather response has no wind.speed")
    speed = float(wind["speed"])
    deg = wind.get("deg")
    if deg is None:
        # Direction can be missing when it is calm; otherwise we cannot place the cone.
        if speed <= 0.0:
            return Wind(from_deg=0.0, speed_mps=speed)
        raise ApiError("weather response has wind.speed but no wind.deg")
    return Wind(from_deg=float(deg) % 360.0, speed_mps=speed)


def fetch_wind(cfg: Config, http_get: HttpGet) -> Wind:
    lat, lon = cfg.center
    url = f"{URL}?lat={lat}&lon={lon}&appid={cfg.owm_api_key}"
    return parse_wind(http_get(url, {"Accept": "application/json"}))
