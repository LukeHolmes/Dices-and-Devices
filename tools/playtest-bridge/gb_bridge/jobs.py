from __future__ import annotations

import json
import logging
import os
import signal
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Callable, Optional

from gb_bridge.antigravity import QuotaState, check_quota, record_quota, run_antigravity
from gb_bridge.config import settings
from gb_bridge.holdout import assert_rids_allowed, parse_rid_spec
from gb_bridge.store import JobRecord, JobStore

log = logging.getLogger("gb_bridge.jobs")


class PlaytestExecutor:
    def __init__(self, store: JobStore) -> None:
        self.store = store
        self._procs: dict[str, subprocess.Popen[Any]] = {}
        self._lock = threading.Lock()

    def build_plan(self, payload: dict[str, Any]) -> dict[str, Any]:
        rids = parse_rid_spec(payload.get("rids", payload.get("rid_spec", "0-9")))
        assert_rids_allowed(
            rids,
            payload.get("holdout_approval_id"),
            settings.holdout_approval_id,
        )
        return {
            "baseline": payload.get("baseline", "R-main"),
            "rids": rids,
            "policy_revision": payload.get("policy_revision", "2026-11-11-phase-b-v1"),
            "max_steps": int(payload.get("budget_max_steps", payload.get("max_steps", 12_000))),
            "parallel": int(payload.get("parallel", 2)),
            "replicate": int(payload.get("replicate", 1)),
        }

    def run_playtest(
        self,
        job: JobRecord,
        *,
        should_cancel: Callable[[], bool],
        on_progress: Optional[Callable[[JobRecord], None]] = None,
    ) -> JobRecord:
        job.status = "RUNNING"
        self.store.update(job)
        repo_root = Path(settings.repo_root or Path(__file__).resolve().parents[3])
        script = repo_root / "scripts/diagnostics-batch.cjs"
        if not script.exists():
            job.status = "FAILED"
            job.error = f"missing_runner:{script}"
            self.store.update(job)
            return job

        rid_spec = ",".join(str(r) for r in job.plan["rids"])
        cmd = [
            "node",
            str(script),
            f"--baseline={job.plan['baseline']}",
            f"--rids={rid_spec}",
            f"--max-steps={job.plan['max_steps']}",
            f"--parallel={job.plan['parallel']}",
            f"--replicate={job.plan['replicate']}",
            f"--job-id={job.job_id}",
        ]
        env = os.environ.copy()
        env["SIM_SEED_GAME"] = "1"
        env["SIM_STREET_RAT_PROFILE"] = "1"
        env["SIM_POLICY_REVISION"] = job.plan["policy_revision"]
        env["SIM_LINK_OBSERVER"] = "1"

        creationflags = 0
        if sys.platform == "win32":
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]

        proc = subprocess.Popen(
            cmd,
            cwd=str(repo_root),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            creationflags=creationflags,
        )
        with self._lock:
            self._procs[job.job_id] = proc

        started = time.monotonic()
        try:
            while proc.poll() is None:
                if should_cancel():
                    self._kill_tree(proc)
                    job.status = "CANCELED"
                    job.error = "cancel_requested"
                    self.store.update(job)
                    return job
                if time.monotonic() - started > settings.job_timeout_sec:
                    self._kill_tree(proc)
                    job.status = "TIMED_OUT"
                    job.error = "job_timeout"
                    self.store.update(job)
                    return job
                if on_progress:
                    on_progress(job)
                time.sleep(1.0)
            stdout, stderr = proc.communicate(timeout=30)
            job.logs.extend((stderr or "").splitlines()[-20:])
            if proc.returncode == 0:
                job.status = "SUCCEEDED"
                job.done = job.total
                text = stdout or ""
                try:
                    marker = text.rfind('{\n  "summary"')
                    summary = json.loads(text[marker:] if marker >= 0 else text.strip())
                except Exception:
                    summary = {"raw": text[-4000:]}
                job.result_path = json.dumps(summary)
            else:
                job.status = "FAILED"
                job.error = (stderr or "")[-2000:]
            self.store.update(job)
            return job
        except Exception as exc:  # noqa: BLE001
            self._kill_tree(proc)
            job.status = "FAILED"
            job.error = str(exc)
            self.store.update(job)
            return job
        finally:
            with self._lock:
                self._procs.pop(job.job_id, None)

    def cancel_local(self, job_id: str, reason: str = "canceled") -> Optional[JobRecord]:
        job = self.store.get(job_id)
        if not job:
            return None
        with self._lock:
            proc = self._procs.get(job_id)
        if proc and proc.poll() is None:
            self._kill_tree(proc)
        job.cancel_requested = True
        if job.status == "RUNNING":
            job.status = "CANCELED"
        job.error = reason
        self.store.update(job)
        return job

    @staticmethod
    def _kill_tree(proc: subprocess.Popen[Any]) -> None:
        if proc.poll() is not None:
            return
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], check=False)
        else:
            os.killpg(os.getpgid(proc.pid), signal.SIGKILL)


def run_investigate_defect(payload: dict[str, Any]) -> dict[str, Any]:
    if not settings.antigravity_enabled:
        return {"ok": False, "reason": "antigravity_disabled"}
    quota_path = settings.resolve_antigravity_quota_path()
    state = QuotaState.load(quota_path)
    check_quota(state, settings.antigravity_daily_limit, settings.antigravity_weekly_limit)
    prompt = (
        f"Investigate {payload.get('kind', 'measurement')} defect on job {payload.get('job_id')} "
        f"rid {payload.get('rid')}: {payload.get('defect_hypothesis')}. "
        "Read-only investigation; do not modify gameplay files."
    )
    result = run_antigravity(settings.antigravity_cli, prompt)
    if result.get("ok"):
        record_quota(state)
        state.save(quota_path)
    return result