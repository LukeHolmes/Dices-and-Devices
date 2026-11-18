from gb_bridge.antigravity import run_antigravity


def test_blocked_exit_zero_treated_as_error(monkeypatch):
    class Proc:
        returncode = 0
        stdout = '{"status":"RUNNING","response":""}'
        stderr = "tool approval denied in headless mode"

    monkeypatch.setattr("gb_bridge.antigravity.subprocess.run", lambda *a, **k: Proc())
    out = run_antigravity("agy", "test")
    assert out["ok"] is False