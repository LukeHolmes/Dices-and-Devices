from __future__ import annotations

import json
import logging
import os
import shlex
import subprocess
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from gb_bridge.antigravity_interpret import interpret_antigravity_payload, parse_antigravity_stdout
from gb_bridge.antigravity_ledger import AntigravityLedger

log = logging.getLogger("gb_bridge.antigravity")

FORBIDDEN_ANTIGRAVITY_FLAGS = frozenset({"--dangerously-skip-permissions"})


def assert_antigravity_args_safe(args: str | list[str]) -> None:
    parts = shlex.split(args, posix=(os.name != "nt")) if isinstance(args, str) else list(args)
    for token in parts:
        flag = token.split("=", 1)[0].strip().lower()
        if flag in FORBIDDEN_ANTIGRAVITY_FLAGS or "dangerously-skip-permissions" in flag:
            raise RuntimeError(
                "Antigravity flag --dangerously-skip-permissions is not allowed in the playtest bridge",
            )


def parse_antigravity_extra_args(raw: str) -> list[str]:
    raw = (raw or "").strip()
    if not raw:
        return []
    parts = shlex.split(raw, posix=(os.name != "nt"))
    assert_antigravity_args_safe(parts)
    return parts


def build_antigravity_argv(
    cli: str,
    prompt: str,
    *,
    output_format: str = "json",
    mode: str = "plan",
    print_timeout_sec: int = 600,
    model: str = "",
    sandbox: str = "",
    json_schema: str = "",
    extra_args: list[str] | None = None,
) -> list[str]:
    extra = list(extra_args or [])
    assert_antigravity_args_safe(extra)
    argv: list[str] = [
        cli,
        "-p",
        prompt,
        "--output-format",
        output_format,
        f"--print-timeout={print_timeout_sec}s",
        "--mode",
        mode,
    ]
    if model.strip():
        argv.extend(["--model", model.strip()])
    if sandbox.strip():
        argv.extend(["--sandbox", sandbox.strip()])
    if json_schema.strip():
        argv.extend(["--json-schema", json_schema.strip()])
    argv.extend(extra)
    assert_antigravity_args_safe(argv)
    return argv


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


def check_antigravity_ledger(
    ledger: AntigravityLedger,
    *,
    window_limit: int,
    window_hours: float,
    daily_limit: int,
    weekly_limit: int,
) -> None:
    ledger.check_limits(
        window_limit=window_limit,
        window_hours=window_hours,
        daily_limit=daily_limit,
        weekly_limit=weekly_limit,
    )


def record_antigravity_ledger(
    ledger: AntigravityLedger,
    result: dict[str, Any],
    *,
    job_id: str = "",
) -> None:
    ledger.append_call(
        {
            "job_id": job_id,
            "ok": bool(result.get("ok")),
            "reason": result.get("reason"),
            "conversation_id": result.get("conversation_id"),
            "total_tokens": int(result.get("total_tokens") or 0),
            "usage": result.get("usage") or {},
            "duration_seconds": result.get("duration_seconds"),
            "num_turns": result.get("num_turns"),
        },
    )


def run_antigravity(
    cli: str,
    prompt: str,
    timeout_sec: int | None = None,
    *,
    output_format: str = "json",
    mode: str = "plan",
    model: str = "",
    sandbox: str = "",
    json_schema: str = "",
    extra_args: list[str] | None = None,
) -> dict[str, Any]:
    print_timeout = int(timeout_sec if timeout_sec is not None else 600)
    version = antigravity_cli_version(cli)
    argv = build_antigravity_argv(
        cli,
        prompt,
        output_format=output_format,
        mode=mode,
        print_timeout_sec=print_timeout,
        model=model,
        sandbox=sandbox,
        json_schema=json_schema,
        extra_args=extra_args,
    )
    log.info(
        "antigravity_invoke cli=%s version=%s mode=%s output_format=%s timeout_sec=%s",
        cli,
        version,
        mode,
        output_format,
        print_timeout,
    )
    proc = subprocess.run(
        argv,
        capture_output=True,
        text=True,
        timeout=print_timeout + 30,
        check=False,
    )
    stderr = proc.stderr or ""
    stdout = proc.stdout or ""
    if "approval" in stderr.lower() and "denied" in stderr.lower():
        return {"ok": False, "degraded": True, "reason": "tool_approval_denied", "stderr": stderr}
    if proc.returncode != 0 and not stdout.strip():
        return {"ok": False, "reason": "nonzero_exit", "stderr": stderr, "code": proc.returncode}
    try:
        payload = parse_antigravity_stdout(stdout)
    except json.JSONDecodeError:
        return {"ok": False, "reason": "invalid_json", "stdout": stdout, "stderr": stderr}
    return interpret_antigravity_payload(payload, stderr=stderr, proc_returncode=proc.returncode)