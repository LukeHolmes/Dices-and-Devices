from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


def _parse_ts(raw: str) -> datetime | None:
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _day_key(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")


def _week_key(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%G-W%V")


@dataclass
class LedgerCounts:
    window_calls: int
    daily_calls: int
    weekly_calls: int


class AntigravityLedger:
    def __init__(self, path: Path) -> None:
        self.path = path

    def load_entries(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        entries: list[dict[str, Any]] = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue
        return entries

    def count_calls(
        self,
        *,
        window_hours: float,
        now: datetime | None = None,
    ) -> LedgerCounts:
        now = now or _utc_now()
        window_start = now - timedelta(hours=window_hours)
        day = _day_key(now)
        week = _week_key(now)
        window_calls = 0
        daily_calls = 0
        weekly_calls = 0
        for entry in self.load_entries():
            if entry.get("kind") != "call":
                continue
            ts = _parse_ts(str(entry.get("ts", "")))
            if ts is None:
                continue
            if ts >= window_start:
                window_calls += 1
            if _day_key(ts) == day:
                daily_calls += 1
            if _week_key(ts) == week:
                weekly_calls += 1
        return LedgerCounts(window_calls=window_calls, daily_calls=daily_calls, weekly_calls=weekly_calls)

    def check_limits(
        self,
        *,
        window_limit: int,
        window_hours: float,
        daily_limit: int = 0,
        weekly_limit: int,
        now: datetime | None = None,
    ) -> None:
        counts = self.count_calls(window_hours=window_hours, now=now)
        if window_limit > 0 and counts.window_calls >= window_limit:
            raise RuntimeError("antigravity_window_quota_exhausted")
        if daily_limit > 0 and counts.daily_calls >= daily_limit:
            raise RuntimeError("antigravity_daily_quota_exhausted")
        if weekly_limit > 0 and counts.weekly_calls >= weekly_limit:
            raise RuntimeError("antigravity_weekly_quota_exhausted")

    def append_call(
        self,
        record: dict[str, Any],
        *,
        now: datetime | None = None,
    ) -> None:
        now = now or _utc_now()
        row = {
            "ts": now.isoformat(),
            "kind": "call",
            **record,
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(row, ensure_ascii=True) + "\n")