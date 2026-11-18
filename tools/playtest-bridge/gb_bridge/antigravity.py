from __future__ import annotations

import json
import logging
import subprocess
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

log = logging.getLogger("gb_bridge.antigravity")


def antigravity_cli_version(cli: str, timeout_sec: int = 30) -> str:
    proc = subprocess.run(
        [cli, "--version"],
        capture_output=True,
        text=True,
        timeout=timeout_sec,
        check=False,
    )
    text = (proc.stdout or proc.stderr or "").strip()
    return text or "unknown"


@dataclass
class QuotaState:
    daily: dict[str, int]
    weekly: dict[str, int]

    @classmethod
    def load(cls, path: Path) -> "QuotaState":
        if not path.exists():
            return cls(daily=defaultdict(int), weekly=defaultdict(int))
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(daily=defaultdict(int, data.get("daily", {})), weekly=defaultdict(int, data.get("weekly", {})))

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps({"daily": dict(self.daily), "weekly": dict(self.weekly)}, indent=2),
            encoding="utf-8",
        )


def _day_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _week_key() -> str:
    return datetime.now(timezone.utc).strftime("%G-W%V")


def check_quota(state: QuotaState, daily_limit: int, weekly_limit: int) -> None:
    d = state.daily[_day_key()]
    w = state.weekly[_week_key()]
    if d >= daily_limit:
        raise RuntimeError("antigravity_daily_quota_exhausted")
    if w >= weekly_limit:
        raise RuntimeError("antigravity_weekly_quota_exhausted")


def record_quota(state: QuotaState) -> None:
    state.daily[_day_key()] += 1
    state.weekly[_week_key()] += 1


def run_antigravity(
    cli: str,
    prompt: str,
    timeout_sec: int = 600,
) -> dict[str, Any]:
    version = antigravity_cli_version(cli)
    log.info("antigravity_invoke cli=%s version=%s", cli, version)
    proc = subprocess.run(
        [cli, "-p", prompt, "--output-format", "json", f"--print-timeout={timeout_sec}s"],
        capture_output=True,
        text=True,
        timeout=timeout_sec + 30,
        check=False,
    )
    stderr = proc.stderr or ""
    if "approval" in stderr.lower() and "denied" in stderr.lower():
        return {"ok": False, "degraded": True, "reason": "tool_approval_denied", "stderr": stderr}
    if proc.returncode != 0 and not proc.stdout.strip():
        return {"ok": False, "reason": "nonzero_exit", "stderr": stderr, "code": proc.returncode}
    try:
        payload = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "reason": "invalid_json", "stdout": proc.stdout, "stderr": stderr}
    if payload.get("status") not in (None, "SUCCESS") and payload.get("error"):
        return {"ok": False, "reason": "error_status", "payload": payload, "stderr": stderr}
    if proc.returncode == 0 and payload.get("status") == "SUCCESS":
        return {"ok": True, "payload": payload}
    if proc.returncode == 0:
        return {"ok": False, "reason": "blocked_action_exit_0", "payload": payload, "stderr": stderr}
    return {"ok": False, "reason": "failed", "payload": payload, "stderr": stderr, "code": proc.returncode}