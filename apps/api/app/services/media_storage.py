"""S3-совместимое хранилище вложений сделок + presigned GET (без публичных URL Telegram/Meta в БД)."""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid
from functools import lru_cache
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import Settings, get_settings

log = logging.getLogger("uvicorn.error")


def _prefix_norm(settings: Settings) -> str:
    return settings.S3_MEDIA_PREFIX.strip().strip("/")


def deal_media_key_prefix(deal_id: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    pid = (deal_id or "").strip()
    return f"{_prefix_norm(settings)}/deals/{pid}"


def is_media_storage_configured() -> bool:
    s = get_settings()
    return bool(
        s.S3_BUCKET.strip()
        and s.AWS_ACCESS_KEY_ID.strip()
        and s.AWS_SECRET_ACCESS_KEY.strip()
    )


@lru_cache
def _s3_client_factory(
    bucket: str,
    region: str,
    access_key: str,
    secret_key: str,
    endpoint_url: str,
):
    kwargs: dict[str, Any] = dict(
        service_name="s3",
        region_name=region or "us-east-1",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
    )
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    return boto3.client(**kwargs)


def _s3_client():
    s = get_settings()
    endpoint = (s.S3_ENDPOINT_URL or "").strip()
    return _s3_client_factory(
        s.S3_BUCKET.strip(),
        (s.S3_REGION or "us-east-1").strip(),
        s.AWS_ACCESS_KEY_ID.strip(),
        s.AWS_SECRET_ACCESS_KEY.strip(),
        endpoint,
    )


def storage_key_belongs_to_deal(deal_id: str, key: str) -> bool:
    deal_id = (deal_id or "").strip()
    key = (key or "").strip()
    if not deal_id or not key:
        return False
    expected_prefix = deal_media_key_prefix(deal_id) + "/"
    if not key.startswith(expected_prefix):
        return False
    if ".." in key or key.startswith("/"):
        return False
    return True


def deal_json_contains_storage_key(deal_comments: Any, key: str) -> bool:
    if not key:
        return False
    try:
        blob = json.dumps(deal_comments or [], ensure_ascii=False)
    except (TypeError, ValueError):
        return False
    return key in blob


def _safe_filename_ext(filename_hint: str | None, content_type: str) -> str:
    import mimetypes

    if filename_hint and "." in filename_hint:
        ext = "." + filename_hint.rsplit(".", 1)[-1].lower()
        ext = re.sub(r"[^.a-z0-9]", "", ext)[:14]
        if len(ext) > 1:
            return ext
    ct = (content_type or "").split(";")[0].strip().lower()
    guess = mimetypes.guess_extension(ct) or ""
    if guess in (".jpe",):
        return ".jpg"
    return guess or ".bin"


async def upload_deal_media_bytes(
    *,
    deal_id: str,
    source: str,
    body: bytes,
    content_type: str,
    filename_hint: str | None = None,
) -> str:
    if not is_media_storage_configured():
        raise RuntimeError("s3_not_configured")
    if not body:
        raise ValueError("empty_body")
    s = get_settings()
    bucket = s.S3_BUCKET.strip()
    prefix = deal_media_key_prefix(deal_id, s)
    sub = re.sub(r"[^a-zA-Z0-9._-]+", "", (source or "bin")[:24]) or "bin"
    ext = _safe_filename_ext(filename_hint, content_type)
    key = f"{prefix}/{sub}/{uuid.uuid4().hex}{ext}"
    ct = (content_type or "application/octet-stream").split(";")[0].strip() or "application/octet-stream"

    def _put() -> None:
        cli = _s3_client()
        cli.put_object(Bucket=bucket, Key=key, Body=body, ContentType=ct)

    await asyncio.to_thread(_put)
    return key


async def generate_presigned_get_url_async(key: str, expires_seconds: int | None = None) -> str | None:
    if not is_media_storage_configured():
        return None
    s = get_settings()
    sec = int(expires_seconds if expires_seconds is not None else s.S3_SIGNED_URL_EXPIRE_SECONDS)
    sec = max(60, min(sec, 86_400))
    bucket = s.S3_BUCKET.strip()

    def _gen() -> str:
        cli = _s3_client()
        return cli.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=sec,
        )

    try:
        return await asyncio.to_thread(_gen)
    except (BotoCoreError, ClientError, ValueError, TypeError) as exc:
        log.warning("media_storage presign failed: %s", exc)
        return None
