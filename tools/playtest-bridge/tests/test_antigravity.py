from gb_bridge.antigravity import QuotaState, antigravity_cli_version, run_antigravity
from gb_bridge.config import settings
from gb_bridge.jobs import run_investigate_defect


def test_blocked_exit_zero_treated_as_error(monkeypatch):
    class Proc:
        returncode = 0
        stdout = '{"status":"RUNNING","response":""}'
        stderr = "tool approval denied in headless mode"

    def fake_run(cmd, **kwargs):
        if "--version" in cmd:
            p = Proc()
            p.stdout = "agy version 1.5.11"
            p.stderr = ""
            return p
        return Proc()

    monkeypatch.setattr("gb_bridge.antigravity.subprocess.run", fake_run)
    out = run_antigravity("agy", "test")
    assert out["ok"] is False


def test_antigravity_cli_version(monkeypatch):
    class Proc:
        returncode = 0
        stdout = "Antigravity CLI 1.5.11"
        stderr = ""

    monkeypatch.setattr("gb_bridge.antigravity.subprocess.run", lambda *a, **k: Proc())
    assert "1.5.11" in antigravity_cli_version(r"C:\Users\x\AppData\Local\agy\bin\agy.exe")


def test_investigate_uses_shared_quota_path(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.json"
    monkeypatch.setattr(settings, "antigravity_enabled", True)
    monkeypatch.setattr(settings, "antigravity_quota_path", str(ledger))
    monkeypatch.setattr(
        "gb_bridge.jobs.run_antigravity",
        lambda *a, **k: {"ok": True, "payload": {"status": "SUCCESS"}},
    )
    run_investigate_defect({"job_id": "j1", "rid": 0, "defect_hypothesis": "test"})
    assert ledger.exists()
    state = QuotaState.load(ledger)
    assert sum(state.daily.values()) == 1