from __future__ import annotations

import hashlib
import hmac
import time
from typing import Optional

from fastapi import Header, HTTPException, Request

from gb_bridge.config import settings


def _bearer_ok(authorization: Optional[str]) -> bool:
    if not settings.bearer_token:
        return False
    if not authorization or not authorization.startswith("Bearer "):
        return False
    token = authorization.removeprefix("Bearer ").strip()
    return hmac.compare_digest(token, settings.bearer_token)


def _hmac_ok(request: Request, signature: Optional[str], timestamp: Optional[str], nonce: Optional[str]) -> bool:
    if not settings.hmac_secret or not signature or not timestamp or not nonce:
        return False
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    if abs(time.time() - ts) > 60:
        return False
    body = request.scope.get("_body_cache", b"")
    msg = f"{timestamp}.{nonce}.{body.decode('utf-8', errors='ignore')}".encode()
    digest = hmac.new(settings.hmac_secret.encode(), msg, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


async def require_auth(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    x_gb_signature: Optional[str] = Header(default=None),
    x_gb_timestamp: Optional[str] = Header(default=None),
    x_gb_nonce: Optional[str] = Header(default=None),
) -> None:
    if _bearer_ok(authorization):
        return
    body = await request.body()
    request.scope["_body_cache"] = body
    if _hmac_ok(request, x_gb_signature, x_gb_timestamp, x_gb_nonce):
        return
    raise HTTPException(status_code=401, detail="unauthorized")