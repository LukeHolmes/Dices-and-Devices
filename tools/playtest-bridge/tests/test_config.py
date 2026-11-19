import pytest

from gb_bridge.config import BridgeSettings, default_antigravity_cli


def test_default_antigravity_cli_windows_path(monkeypatch):
    monkeypatch.setenv("LOCALAPPDATA", r"C:\Users\Luke\AppData\Local")
    assert default_antigravity_cli().replace("\\", "/").endswith("agy/bin/agy.exe")


def test_default_antigravity_cli_without_localappdata(monkeypatch):
    monkeypatch.delenv("LOCALAPPDATA", raising=False)
    assert default_antigravity_cli() == "agy"


def test_rejects_localai_webhook_prefix():
    cfg = BridgeSettings(
        n8n_header_value="secret",
        n8n_webhook_prefix="/webhook/localai",
    )
    with pytest.raises(RuntimeError, match="localai"):
        cfg.assert_playtest_webhook_config()


def test_rejects_localai_in_base_url():
    cfg = BridgeSettings(
        n8n_header_value="secret",
        n8n_base_url="http://127.0.0.1:5678/webhook/localai",
        n8n_webhook_prefix="/webhook/playtest",
    )
    with pytest.raises(RuntimeError, match="localai"):
        cfg.assert_playtest_webhook_config()


def test_shared_antigravity_ledger_path(tmp_path, monkeypatch):
    ledger = tmp_path / "shared-antigravity-ledger.jsonl"
    cfg = BridgeSettings(
        n8n_header_value="x",
        antigravity_ledger_path=str(ledger),
        state_dir=str(tmp_path / "state"),
    )
    assert cfg.resolve_antigravity_ledger_path() == ledger
    assert cfg.resolve_antigravity_quota_path() == ledger


def test_default_antigravity_sandbox_on():
    cfg = BridgeSettings(n8n_header_value="x")
    assert cfg.antigravity_sandbox == "on"


def test_antigravity_settings_and_cwd_env():
    cfg = BridgeSettings(
        n8n_header_value="x",
        antigravity_settings_file=r"C:\Users\holme\agy-jobs\_config\readonly-repos.settings.json",
        antigravity_cwd=r"C:\Users\holme\agy-repos\Dices-and-Devices",
    )
    assert cfg.antigravity_settings_file.endswith("readonly-repos.settings.json")
    assert cfg.antigravity_cwd.endswith("Dices-and-Devices")


def test_default_antigravity_budget_limits():
    cfg = BridgeSettings(n8n_header_value="x")
    assert cfg.antigravity_window_limit == 0
    assert cfg.antigravity_window_hours == 5.0
    assert cfg.antigravity_daily_limit == 0
    assert cfg.antigravity_weekly_limit == 0


def test_validate_startup_ok():
    cfg = BridgeSettings(
        n8n_header_value="secret",
        n8n_webhook_prefix="/webhook/playtest",
    )
    cfg.validate_startup()