"""R2.2: write plumes.json (S3 for the real pipeline, a local file for dev/demo)."""
from __future__ import annotations

import os
import tempfile
from typing import Any, Optional

from .config import Config


def publish_s3(cfg: Config, body: str, client: Optional[Any] = None) -> None:
    if not cfg.s3_bucket:
        raise ValueError("BREEZY_S3_BUCKET is not set")
    if client is None:
        import boto3  # imported lazily so tests and local runs don't need AWS

        client = boto3.client("s3")
    client.put_object(
        Bucket=cfg.s3_bucket,
        Key=cfg.s3_key,
        Body=body.encode("utf-8"),
        ContentType="application/json",
        CacheControl=cfg.cache_control,
    )


def publish_local(path: str, body: str) -> None:
    """Atomic write so a reader never sees a half-written file."""
    directory = os.path.dirname(os.path.abspath(path))
    fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(body)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
