from __future__ import annotations

import json
import re
from typing import Any

DEFAULT_DIRECT_ANSWER_PREAMBLE = (
    "You are invoked by an automated playtest bridge for read-only defect investigation. "
    "Answer directly in the JSON response field. Do NOT write plan artifacts under "
    "%USERPROFILE%\\.gemini\\antigravity-cli\\brain or say you created an implementation plan. "
    "Summarize findings in this response only."
)

_PLAN_NON_ANSWER_RE = re.compile(
    r"created the implementation plan|implementation plan under|antigravity-cli[\\/]brain",
    re.IGNORECASE,
)


def strip_markdown_json_fences(text: str) -> str:
    t = (text or "").strip()
    if not t.startswith("```"):
        return t
    lines = t.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].strip() == "```":
        lines = lines[:-1]
    return "\n".join(lines).strip()


def parse_antigravity_stdout(stdout: str) -> dict[str, Any]:
    cleaned = strip_markdown_json_fences(stdout)
    return json.loads(cleaned)


def is_plan_artifact_non_answer(response: str) -> bool:
    if not response or not response.strip():
        return False
    return bool(_PLAN_NON_ANSWER_RE.search(response))


def is_headless_command_permission_denied(stderr: str, response: str) -> bool:
    s = (stderr or "").lower()
    if "no output produced" in s and "command" in s and "permission" in s:
        return True
    if 'required the "command" permission' in s:
        return True
    if not (response or "").strip() and "permission" in s and "command" in s:
        return True
    return False


def extract_usage(payload: dict[str, Any]) -> dict[str, Any]:
    usage = payload.get("usage")
    if isinstance(usage, dict):
        return usage
    return {}


def _response_text(payload: dict[str, Any]) -> str:
    response = payload.get("response")
    if response is None:
        return ""
    if isinstance(response, str):
        return response
    return json.dumps(response, ensure_ascii=True)


def interpret_antigravity_payload(
    payload: dict[str, Any],
    *,
    stderr: str = "",
    proc_returncode: int = 0,
) -> dict[str, Any]:
    response_text = _response_text(payload)
    usage = extract_usage(payload)
    total_tokens = int(usage.get("total_tokens") or 0)
    base: dict[str, Any] = {
        "conversation_id": payload.get("conversation_id"),
        "status": payload.get("status"),
        "duration_seconds": payload.get("duration_seconds"),
        "num_turns": payload.get("num_turns"),
        "usage": usage,
        "total_tokens": total_tokens,
        "response_excerpt": response_text[:500] if response_text else "",
    }

    if is_headless_command_permission_denied(stderr, response_text):
        return {
            **base,
            "ok": False,
            "reason": "headless_command_permission_denied",
            "stderr": stderr,
            "payload": payload,
        }

    status = str(payload.get("status") or "").upper()
    if payload.get("error") and status and status != "SUCCESS":
        return {**base, "ok": False, "reason": "error_status", "payload": payload, "stderr": stderr}

    if proc_returncode != 0 and not response_text.strip():
        return {**base, "ok": False, "reason": "nonzero_exit", "stderr": stderr, "code": proc_returncode}

    if status == "SUCCESS" or proc_returncode == 0:
        if not response_text.strip():
            return {
                **base,
                "ok": False,
                "reason": "empty_response",
                "stderr": stderr,
                "payload": payload,
            }
        if is_plan_artifact_non_answer(response_text):
            return {
                **base,
                "ok": False,
                "reason": "plan_artifact_non_answer",
                "stderr": stderr,
                "payload": payload,
            }
        if status == "SUCCESS" and proc_returncode == 0:
            return {**base, "ok": True, "payload": payload, "response": response_text}
        if proc_returncode == 0:
            return {
                **base,
                "ok": False,
                "reason": "blocked_action_exit_0",
                "payload": payload,
                "stderr": stderr,
            }

    return {**base, "ok": False, "reason": "failed", "payload": payload, "stderr": stderr, "code": proc_returncode}