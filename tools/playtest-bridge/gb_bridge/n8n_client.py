from __future__ import annotations

import json
import time
from typing import Any, Optional

import httpx

from gb_bridge.config import settings


class N8nClient:
    def __init__(self, client: Optional[httpx.Client] = None) -> None:
        headers = {settings.n8n_header_name: settings.n8n_header_value}
        self._client = client or httpx.Client(
            timeout=settings.request_timeout_sec,
            headers=headers,
        )
        self._owns_client = client is None

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = settings.webhook_url(path)
        delays = (0.0, 0.75, 2.0, 4.0)
        last_exc: Exception | None = None
        for attempt, delay in enumerate(delays):
            if delay:
                time.sleep(delay)
            try:
                resp = self._client.post(url, json=payload)
                if resp.status_code == 400:
                    raise httpx.HTTPStatusError(
                        "n8n webhook HTTP 400 (often HA nginx truncation)",
                        request=resp.request,
                        response=resp,
                    )
                resp.raise_for_status()
                if not resp.content:
                    raise ValueError("empty webhook response body")
                try:
                    return resp.json()
                except json.JSONDecodeError as exc:
                    raise ValueError(f"invalid JSON webhook body: {exc}") from exc
            except (httpx.HTTPStatusError, httpx.TransportError, ValueError) as exc:
                last_exc = exc
                if attempt >= len(delays) - 1:
                    raise
        if last_exc:
            raise last_exc
        return {}

    def poll(self, worker_id: str) -> dict[str, Any]:
        return self._post(
            "/poll",
            {"worker_id": worker_id, "capabilities": ["start_playtest", "investigate_defect"]},
        )

    def claim(self, worker_id: str, remote_job_id: str, lease_sec: int) -> dict[str, Any]:
        return self._post(
            "/claim",
            {"worker_id": worker_id, "job_id": remote_job_id, "lease_sec": lease_sec},
        )

    def heartbeat(self, worker_id: str, remote_job_id: str, lease_sec: int, status: dict[str, Any]) -> dict[str, Any]:
        return self._post(
            "/heartbeat",
            {
                "worker_id": worker_id,
                "job_id": remote_job_id,
                "lease_sec": lease_sec,
                "status": status,
            },
        )

    def post_status(self, worker_id: str, remote_job_id: str, status: dict[str, Any]) -> dict[str, Any]:
        return self._post(
            "/status",
            {"worker_id": worker_id, "job_id": remote_job_id, "status": status},
        )

    def post_results(self, worker_id: str, remote_job_id: str, results: dict[str, Any]) -> dict[str, Any]:
        return self._post(
            "/results",
            {"worker_id": worker_id, "job_id": remote_job_id, "results": results},
        )

    def post_interrupted(
        self,
        worker_id: str,
        remote_job_id: str,
        reason: str,
        requeue: bool = True,
    ) -> dict[str, Any]:
        return self._post(
            "/interrupted",
            {
                "worker_id": worker_id,
                "job_id": remote_job_id,
                "reason": reason,
                "requeue": requeue,
            },
        )

    @staticmethod
    def safe_json(data: Any) -> str:
        return json.dumps(data, ensure_ascii=True, default=str)