import pytest

from gb_bridge.antigravity import (
    antigravity_cli_version,
    build_antigravity_argv,
    assert_antigravity_args_safe,
    run_antigravity,
)
from gb_bridge.config import BridgeSettings, settings
from gb_bridge.jobs import build_investigate_prompt, run_investigate_defect


def test_build_antigravity_argv_defaults():
    argv = build_antigravity_argv("agy.exe", "hello")
    assert argv[0] == "agy.exe"
    assert "-p" in argv and "hello" in argv
    assert "--output-format" in argv and argv[argv.index("--output-format") + 1] == "json"
    assert "--mode" in argv and argv[argv.index("--mode") + 1] == "plan"
    assert any(a.startswith("--print-timeout=") for a in argv)


def test_rejects_dangerously_skip_permissions_in_extra_args():
    with pytest.raises(RuntimeError, match="dangerously-skip-permissions"):
        assert_antigravity_args_safe("--dangerously-skip-permissions")


def test_validate_startup_rejects_dangerous_extra_args():
    cfg = BridgeSettings(
        n8n_header_value="secret",
        antigravity_enabled=True,
        antigravity_extra_args="--dangerously-skip-permissions",
    )
    with pytest.raises(RuntimeError, match="dangerously-skip-permissions"):
        cfg.validate_startup()


def test_blocked_exit_zero_treated_as_error(monkeypatch):
    class Proc:
        returncode = 0
        stdout = '{"status":"RUNNING","response":""}'
        stderr = "tool approval denied in headless mode"

    captured: dict[str, list[str]] = {}

    def fake_run(cmd, **kwargs):
        if "--version" in cmd:
            p = Proc()
            p.stdout = "agy version 1.5.11"
            p.stderr = ""
            return p
        captured["cmd"] = list(cmd)
        return Proc()

    monkeypatch.setattr("gb_bridge.antigravity.subprocess.run", fake_run)
    out = run_antigravity("agy", "test", mode="plan", output_format="json")
    assert out["ok"] is False
    assert captured["cmd"][captured["cmd"].index("--mode") + 1] == "plan"


def test_antigravity_cli_version(monkeypatch):
    class Proc:
        returncode = 0
        stdout = "Antigravity CLI 1.5.11"
        stderr = ""

    monkeypatch.setattr("gb_bridge.antigravity.subprocess.run", lambda *a, **k: Proc())
    assert "1.5.11" in antigravity_cli_version(r"C:\Users\x\AppData\Local\agy\bin\agy.exe")


def test_investigate_uses_shared_ledger_and_preamble(tmp_path, monkeypatch):
    ledger = tmp_path / "ledger.jsonl"
    monkeypatch.setattr(settings, "antigravity_enabled", True)
    monkeypatch.setattr(settings, "antigravity_ledger_path", str(ledger))
    captured: dict[str, str] = {}

    def fake_run(cli, prompt, **kwargs):
        captured["prompt"] = prompt
        return {
            "ok": True,
            "conversation_id": "c1",
            "total_tokens": 10600,
            "usage": {"total_tokens": 10600},
            "duration_seconds": 1.0,
            "num_turns": 1,
        }

    monkeypatch.setattr("gb_bridge.jobs.run_antigravity", fake_run)
    out = run_investigate_defect({"job_id": "j1", "rid": 0, "defect_hypothesis": "test"})
    assert out["total_tokens"] == 10600
    assert ledger.exists()
    lines = [ln for ln in ledger.read_text().splitlines() if ln.strip()]
    assert len(lines) == 1
    assert "antigravity-cli" in captured["prompt"].lower()
    assert "implementation plan" in captured["prompt"].lower()


def test_build_argv_includes_json_schema():
    argv = build_antigravity_argv("agy", "p", json_schema='{"type":"object"}')
    assert "--json-schema" in argv


def test_investigate_prompt_custom_preamble(monkeypatch):
    monkeypatch.setattr(settings, "antigravity_direct_answer_preamble", "Reply only in JSON.")
    prompt = build_investigate_prompt({"job_id": "j", "rid": 0, "defect_hypothesis": "x"})
    assert prompt.startswith("Reply only in JSON.")


def test_command_permission_via_run_antigravity(monkeypatch):
    class Proc:
        returncode = 0
        stdout = '{"status":"SUCCESS","response":"","usage":{"total_tokens":10600}}'
        stderr = 'no output produced — a tool required the "command" permission'

    def fake_run(cmd, **kwargs):
        if "--version" in cmd:
            p = Proc()
            p.stdout = "agy 1.5.11"
            p.stderr = ""
            return p
        return Proc()

    monkeypatch.setattr("gb_bridge.antigravity.subprocess.run", fake_run)
    out = run_antigravity("agy", "test")
    assert out["ok"] is False
    assert out["reason"] == "headless_command_permission_denied"
    assert out["total_tokens"] == 10600