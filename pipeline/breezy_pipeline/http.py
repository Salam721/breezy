"""Tiny HTTP helper (stdlib only, so the Lambda needs no extra HTTP dependency)."""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request
from typing import Any, Callable, Dict, Optional

HttpGet = Callable[[str, Dict[str, str]], Dict[str, Any]]


class ApiError(Exception):
    pass


def redact(text: str) -> str:
    """Remove API keys from anything that might be logged."""
    return re.sub(r"(appid=)[^&\s]+", r"\1***", text)


def default_http_get(
    url: str,
    headers: Optional[Dict[str, str]] = None,
    timeout: float = 15.0,
    retries: int = 2,
    sleep: Callable[[float], None] = time.sleep,
) -> Dict[str, Any]:
    """GET `url` and return parsed JSON. Retries 429 and 5xx a couple of times."""
    last: Optional[Exception] = None
    for attempt in range(retries + 1):
        req = urllib.request.Request(url, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                wait = 2.0 * (attempt + 1)
                reset = e.headers.get("x-ratelimit-reset") if e.headers else None
                if e.code == 429 and reset and reset.isdigit():
                    wait = min(float(reset), 30.0)
                sleep(wait)
                continue
            raise ApiError(f"HTTP {e.code} for {redact(url)}") from None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last = e
            if attempt < retries:
                sleep(2.0 * (attempt + 1))
                continue
            raise ApiError(f"request failed for {redact(url)}: {type(e).__name__}") from None
    raise ApiError(f"request failed for {redact(url)}: {last}")
