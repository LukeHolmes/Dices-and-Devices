from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from gb_bridge.config import BridgeSettings

log = logging.getLogger("gb_bridge.ollama")


def ollama_models_loaded(payload: dict[str, Any]) -> bool:
    models = payload.get("models")
    if not isinstance(models, list):
        return False
    return len(models) > 0


def fetch_ollama_ps(
    url: str,
    client: Optional[httpx.Client] = None,
    timeout_sec: float = 5.0,
) -> dict[str, Any]:
    owns = client is None
    http = client or httpx.Client(timeout=timeout_sec)
    try:
        resp = http.get(url)
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, dict):
            raise ValueError("ollama_ps_not_object")
        return data
    finally:
        if owns:
            http.close()


def should_defer_playtest_claim(
    cfg: BridgeSettings,
    client: Optional[httpx.Client] = None,
) -> tuple[bool, str]:
    if not cfg.ollama_defer_enabled:
        return False, ""
    try:
        data = fetch_ollama_ps(cfg.ollama_ps_url, client=client, timeout_sec=cfg.request_timeout_sec)
    except Exception as exc:  # noqa: BLE001
        log.warning("ollama_ps_check_failed err=%s", exc)
        if cfg.ollama_defer_on_check_error:
            return True, "ollama_check_error"
        return False, ""
    if ollama_models_loaded(data):
        return True, "ollama_models_loaded"
    return False, ""