"""ETag + Cache-Control для JSON-списков (docs/API.md §9)."""
from __future__ import annotations

import hashlib
import json
from typing import Any

from fastapi.encoders import jsonable_encoder
from starlette.requests import Request
from starlette.responses import JSONResponse, Response


def normalize_if_none_match(value: str | None) -> str | None:
    if not value:
        return None
    v = value.strip()
    if not v:
        return None
    if v.upper().startswith("W/"):
        v = v[2:].strip()
    if len(v) >= 2 and v[0] == '"' and v[-1] == '"':
        return v[1:-1]
    return v


def json_body_etag(data: Any) -> str:
    safe = jsonable_encoder(data)
    canonical = json.dumps(safe, sort_keys=True, ensure_ascii=False, default=str, separators=(",", ":"))
    return hashlib.md5(canonical.encode("utf-8")).hexdigest()


def json_304_or_response(request: Request, *, data: Any, max_age: int) -> Response:
    etag = json_body_etag(data)
    headers = {
        "Cache-Control": f"private, max-age={max_age}",
        "ETag": f'"{etag}"',
    }
    inm = normalize_if_none_match(request.headers.get("if-none-match"))
    if inm and inm == etag:
        return Response(status_code=304, headers=headers)
    encoded = jsonable_encoder(data)
    return JSONResponse(content=encoded, headers=headers)
