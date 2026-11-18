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


def test_shared_antigravity_quota_path(tmp_path, monkeypatch):
    ledger = tmp_path / "shared-antigravity-quota.json"
    cfg = BridgeSettings(
        n8n_header_value="x",
        antigravity_quota_path=str(ledger),
        state_dir=str(tmp_path / "state"),
    )
    assert cfg.resolve_antigravity_quota_path() == ledger


def test_validate_startup_ok():
    cfg = BridgeSettings(
        n8n_header_value="secret",
        n8n_webhook_prefix="/webhook/playtest",
    )
    cfg.validate_startup()