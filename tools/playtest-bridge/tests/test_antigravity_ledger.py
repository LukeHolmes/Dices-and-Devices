from datetime import datetime, timedelta, timezone

import pytest

from gb_bridge.antigravity_ledger import AntigravityLedger


def _append(ledger: AntigravityLedger, when: datetime) -> None:
    ledger.append_call({"ok": True, "total_tokens": 10}, now=when)


def test_window_daily_weekly_limits(tmp_path):
    path = tmp_path / "ledger.jsonl"
    ledger = AntigravityLedger(path)
    base = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)
    for i in range(4):
        _append(ledger, base - timedelta(minutes=30 * i))
    ledger.check_limits(window_limit=5, window_hours=5, daily_limit=0, weekly_limit=80, now=base)
    _append(ledger, base)
    with pytest.raises(RuntimeError, match="antigravity_window_quota_exhausted"):
        ledger.check_limits(window_limit=5, window_hours=5, daily_limit=0, weekly_limit=80, now=base)


def test_daily_limit_optional_when_zero(tmp_path):
    path = tmp_path / "ledger.jsonl"
    ledger = AntigravityLedger(path)
    day = datetime(2026, 11, 18, 20, 0, tzinfo=timezone.utc)
    for i in range(25):
        _append(ledger, day - timedelta(minutes=15 * i))
    ledger.check_limits(window_limit=100, window_hours=5, daily_limit=0, weekly_limit=80, now=day)


def test_daily_limit(tmp_path):
    path = tmp_path / "ledger.jsonl"
    ledger = AntigravityLedger(path)
    day = datetime(2026, 11, 18, 20, 0, tzinfo=timezone.utc)
    for i in range(20):
        _append(ledger, day - timedelta(minutes=15 * i))
    with pytest.raises(RuntimeError, match="antigravity_daily_quota_exhausted"):
        ledger.check_limits(window_limit=100, window_hours=5, daily_limit=20, weekly_limit=80, now=day)