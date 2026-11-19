import json

import pytest

from gb_bridge.antigravity import run_antigravity
from gb_bridge.antigravity_interpret import (
    interpret_antigravity_payload,
    is_plan_artifact_non_answer,
    parse_antigravity_stdout,
    strip_markdown_json_fences,
    try_quota_wait_result,
)


def test_strip_json_fences():
    raw = '```json\n{"status": "SUCCESS"}\n```'
    assert parse_antigravity_stdout(raw)["status"] == "SUCCESS"


def test_plan_artifact_detected():
    msg = "I have created the implementation plan under .gemini\\antigravity-cli\\brain\\foo.md"
    assert is_plan_artifact_non_answer(msg)
    out = interpret_antigravity_payload(
        {"status": "SUCCESS", "response": msg, "usage": {"total_tokens": 10600}},
        proc_returncode=0,
    )
    assert out["ok"] is False
    assert out["reason"] == "plan_artifact_non_answer"
    assert out["total_tokens"] == 10600


def test_headless_command_permission_empty_success():
    payload = {"status": "SUCCESS", "response": "", "usage": {"total_tokens": 10600}}
    stderr = 'no output produced — a tool required the "command" permission in headless mode'
    out = interpret_antigravity_payload(payload, stderr=stderr, proc_returncode=0)
    assert out["ok"] is False
    assert out["reason"] == "headless_command_permission_denied"


def test_denied_actions_reported():
    payload = {
        "status": "SUCCESS",
        "response": "",
        "denied_actions": [{"tool": "run_shell_command", "reason": "policy"}],
        "usage": {"total_tokens": 42},
    }
    out = interpret_antigravity_payload(payload, proc_returncode=0)
    assert out["ok"] is False
    assert out["reason"] == "denied_actions"
    assert out["denied_actions"][0]["tool"] == "run_shell_command"


def test_empty_response_success_is_error():
    out = interpret_antigravity_payload(
        {"status": "SUCCESS", "response": ""},
        proc_returncode=0,
    )
    assert out["ok"] is False
    assert out["reason"] == "empty_response"


def test_success_carry_usage_fields():
    out = interpret_antigravity_payload(
        {
            "status": "SUCCESS",
            "response": "Root cause: stale RNG.",
            "conversation_id": "c-1",
            "duration_seconds": 12.5,
            "num_turns": 2,
            "usage": {
                "input_tokens": 10000,
                "output_tokens": 200,
                "thinking_tokens": 0,
                "cache_read_tokens": 0,
                "total_tokens": 10200,
            },
        },
        proc_returncode=0,
    )
    assert out["ok"] is True
    assert out["conversation_id"] == "c-1"
    assert out["total_tokens"] == 10200


def test_run_antigravity_parses_fenced_stdout(monkeypatch):
    class Proc:
        returncode = 0
        stdout = '```json\n' + json.dumps({"status": "SUCCESS", "response": "ok", "usage": {"total_tokens": 1}}) + "\n```"
        stderr = ""

    def fake_run(cmd, **kwargs):
        if "--version" in cmd:
            p = Proc()
            p.stdout = "agy 1.5.11"
            return p
        return Proc()

    monkeypatch.setattr("gb_bridge.antigravity.subprocess.run", fake_run)
    out = run_antigravity("agy", "x")
    assert out["ok"] is True
    assert out["total_tokens"] == 1


def test_agy_quota_wait_from_stderr():
    out = try_quota_wait_result(stderr="Error: 5-hour limit reached for this account", proc_returncode=1)
    assert out is not None
    assert out["reason"] == "quota_wait"
    assert out["retryable"] is True
    assert "retried" in out["message"].lower()


def test_agy_quota_wait_in_payload():
    out = interpret_antigravity_payload(
        {"status": "ERROR", "error": "quota exceeded", "response": ""},
        proc_returncode=1,
    )
    assert out["reason"] == "quota_wait"
    assert out.get("retryable") is True


def test_run_antigravity_quota_wait(monkeypatch):
    class Proc:
        returncode = 1
        stdout = ""
        stderr = "quota exhausted — try again after the 5 hour window resets"

    def fake_run(cmd, **kwargs):
        if "--version" in cmd:
            p = Proc()
            p.stdout = "agy 1.5.11"
            p.stderr = ""
            return p
        return Proc()

    monkeypatch.setattr("gb_bridge.antigravity.subprocess.run", fake_run)
    out = run_antigravity("agy", "x")
    assert out["reason"] == "quota_wait"
    assert out["retryable"] is True