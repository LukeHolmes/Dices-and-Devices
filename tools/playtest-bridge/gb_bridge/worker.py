from __future__ import annotations

import argparse
import json
import logging
import socket
import time
import uuid
from pathlib import Path
from typing import Any

from gb_bridge.antigravity import antigravity_cli_version
from gb_bridge.config import settings
from gb_bridge.jobs import PlaytestExecutor, run_investigate_defect
from gb_bridge.logging_util import setup_logging
from gb_bridge.n8n_client import N8nClient
from gb_bridge.ollama_gate import should_defer_playtest_claim
from gb_bridge.store import JobRecord, JobStore


def default_worker_id() -> str:
    host = socket.gethostname()
    return settings.worker_id or f"{host}-{uuid.uuid4().hex[:8]}"


def state_db_path() -> Path:
    base = Path(settings.state_dir or (Path.home() / ".gb-bridge"))
    base.mkdir(parents=True, exist_ok=True)
    return base / "jobs.sqlite"


def status_payload(job: JobRecord) -> dict[str, Any]:
    return {
        "job_id": job.remote_job_id or job.job_id,
        "local_job_id": job.job_id,
        "status": job.status,
        "done": job.done,
        "total": job.total,
        "updated_at": job.updated_at,
        "error": job.error,
        "logs_tail": job.logs[-20:],
    }


def recover_stale_jobs(store: JobStore, client: N8nClient, worker_id: str) -> None:
    log = logging.getLogger("gb_bridge")
    for job in store.list_stale_leases(worker_id):
        job.status = "INTERRUPTED"
        job.error = "lease_expired_or_worker_restart"
        store.update(job)
        if job.remote_job_id:
            try:
                client.post_interrupted(worker_id, job.remote_job_id, job.error, requeue=True)
            except Exception as exc:  # noqa: BLE001
                log.warning("n8n interrupted notify failed job=%s err=%s", job.remote_job_id, exc)


def handle_poll_message(
    store: JobStore,
    executor: PlaytestExecutor,
    client: N8nClient,
    worker_id: str,
    message: dict[str, Any],
) -> None:
    log = logging.getLogger("gb_bridge")
    for cancel in message.get("cancel", []) or []:
        remote_id = str(cancel.get("job_id", ""))
        local = store.get_by_remote(remote_id)
        if local:
            executor.cancel_local(local.job_id, str(cancel.get("reason", "user_cancel")))
            try:
                client.post_status(worker_id, remote_id, status_payload(local))
            except Exception as exc:  # noqa: BLE001
                log.warning("cancel status post failed: %s", exc)

    for item in message.get("jobs", []) or []:
        remote_id = str(item.get("job_id", ""))
        if not remote_id:
            continue
        if store.get_by_remote(remote_id):
            continue
        operation = str(item.get("operation", "start_playtest"))
        payload = item.get("payload") or item
        try:
            if operation == "investigate_defect":
                if not settings.antigravity_enabled:
                    client.post_results(
                        worker_id,
                        remote_id,
                        {"ok": False, "reason": "antigravity_disabled", "operation": operation},
                    )
                    continue
                result = run_investigate_defect(payload)
                client.post_results(worker_id, remote_id, {"operation": operation, **result})
                continue

            defer, defer_reason = should_defer_playtest_claim(settings)
            if defer:
                log.info(
                    "defer playtest claim remote_job=%s reason=%s backoff_sec=%s",
                    remote_id,
                    defer_reason,
                    settings.ollama_defer_backoff_sec,
                )
                time.sleep(settings.ollama_defer_backoff_sec)
                continue

            plan = executor.build_plan(payload)
            job = store.create(plan, total=len(plan["rids"]) * plan["replicate"], remote_job_id=remote_id, operation=operation)
            claim = client.claim(worker_id, remote_id, settings.lease_duration_sec)
            if claim.get("claimed") is False:
                log.info("claim rejected remote_job=%s", remote_id)
                job.status = "CANCELED"
                job.error = "claim_rejected"
                store.update(job)
                continue
            store.touch_lease(job, settings.lease_duration_sec, worker_id)
            client.post_status(worker_id, remote_id, status_payload(job))

            last_hb = 0.0

            def on_progress(j: JobRecord) -> None:
                nonlocal last_hb
                now = time.monotonic()
                if now - last_hb < settings.heartbeat_interval_sec:
                    return
                last_hb = now
                store.touch_lease(j, settings.lease_duration_sec, worker_id)
                try:
                    hb = client.heartbeat(worker_id, remote_id, settings.lease_duration_sec, status_payload(j))
                    if hb.get("cancel"):
                        j.cancel_requested = True
                        store.update(j)
                except Exception as exc:  # noqa: BLE001
                    log.warning("heartbeat failed job=%s err=%s", remote_id, exc)

            def should_cancel() -> bool:
                current = store.get(job.job_id)
                return bool(current and current.cancel_requested)

            finished = executor.run_playtest(
                job,
                should_cancel=should_cancel,
                on_progress=on_progress,
            )
            if finished.status == "INTERRUPTED":
                client.post_interrupted(worker_id, remote_id, finished.error or "interrupted", requeue=True)
            elif finished.status in ("SUCCEEDED", "FAILED", "CANCELED", "TIMED_OUT"):
                client.post_status(worker_id, remote_id, status_payload(finished))
                summary: Any = finished.result_path
                try:
                    summary = json.loads(finished.result_path)
                except Exception:
                    pass
                client.post_results(
                    worker_id,
                    remote_id,
                    {
                        "operation": operation,
                        "status": finished.status,
                        "summary": summary,
                        "error": finished.error,
                    },
                )
        except Exception as exc:  # noqa: BLE001
            log.exception("job handling failed remote=%s", remote_id)
            try:
                client.post_results(worker_id, remote_id, {"ok": False, "error": str(exc)})
            except Exception:
                pass


def run_worker_once(store: JobStore, executor: PlaytestExecutor, client: N8nClient, worker_id: str) -> None:
    message = client.poll(worker_id)
    if message:
        handle_poll_message(store, executor, client, worker_id, message)


def run_worker_loop(poll_once: bool = False) -> int:
    log = setup_logging()
    settings.validate_startup()
    worker_id = default_worker_id()
    store = JobStore(state_db_path())
    executor = PlaytestExecutor(store)
    client = N8nClient()
    agy_ver = antigravity_cli_version(settings.antigravity_cli) if settings.antigravity_enabled else "disabled"
    log.info(
        "worker_start id=%s n8n=%s webhook_prefix=%s antigravity_cli=%s antigravity_version=%s "
        "antigravity_quota_path=%s ollama_defer=%s",
        worker_id,
        settings.n8n_base_url,
        settings.n8n_webhook_prefix,
        settings.antigravity_cli,
        agy_ver,
        settings.resolve_antigravity_quota_path(),
        settings.ollama_defer_enabled,
    )
    recover_stale_jobs(store, client, worker_id)
    try:
        while True:
            try:
                run_worker_once(store, executor, client, worker_id)
            except Exception as exc:  # noqa: BLE001
                log.warning("poll cycle error: %s", exc)
            if poll_once:
                break
            time.sleep(settings.poll_interval_sec)
    finally:
        client.close()
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Gutterbones outbound n8n playtest worker")
    parser.add_argument("--once", action="store_true", help="Single poll cycle (smoke test)")
    args = parser.parse_args()
    raise SystemExit(run_worker_loop(poll_once=args.once))


if __name__ == "__main__":
    main()