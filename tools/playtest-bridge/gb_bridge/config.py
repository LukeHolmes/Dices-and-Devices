from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

def default_antigravity_cli() -> str:
    localappdata = os.environ.get("LOCALAPPDATA")
    if localappdata:
        return str(Path(localappdata) / "agy" / "bin" / "agy.exe")
    return "agy"


class BridgeSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="GB_BRIDGE_", extra="ignore")

    # Outbound n8n polling (default mode)
    n8n_base_url: str = "http://homeassistant.tailde272c.ts.net:5678"
    n8n_webhook_prefix: str = "/webhook/playtest"
    n8n_header_name: str = "X-GB-Bridge-Key"
    n8n_header_value: str = ""
    poll_interval_sec: float = 5.0
    heartbeat_interval_sec: float = 30.0
    lease_duration_sec: int = 120
    worker_id: str = ""

    # Optional inbound HTTP (off by default; localhost only)
    http_server_enabled: bool = False
    bind_host: str = "127.0.0.1"
    bind_port: int = 8787
    bearer_token: str = ""

    holdout_approval_id: str = ""
    job_timeout_sec: int = 14_400
    game_timeout_sec: int = 900
    repo_root: str = ""
    state_dir: str = ""

    antigravity_enabled: bool = False
    antigravity_window_limit: int = 0
    antigravity_window_hours: float = 5.0
    antigravity_daily_limit: int = 0
    antigravity_weekly_limit: int = 0
    antigravity_cli: str = Field(default_factory=default_antigravity_cli)
    antigravity_ledger_path: str = ""
    antigravity_quota_path: str = ""
    antigravity_direct_answer_preamble: str = ""
    antigravity_output_format: Literal["json", "stream-json"] = "json"
    antigravity_mode: Literal["plan", "accept-edits", "auto"] = "plan"
    antigravity_print_timeout_sec: int = 600
    antigravity_model: str = ""
    antigravity_sandbox: str = "on"
    antigravity_settings_file: str = ""
    antigravity_cwd: str = ""
    antigravity_json_schema: str = ""
    antigravity_extra_args: str = ""

    ollama_defer_enabled: bool = True
    ollama_ps_url: str = "http://127.0.0.1:11434/api/ps"
    ollama_defer_backoff_sec: float = 60.0
    ollama_defer_on_check_error: bool = False

    request_timeout_sec: float = 45.0

    @field_validator("n8n_webhook_prefix")
    @classmethod
    def normalize_prefix(cls, value: str) -> str:
        return value.strip() or "/webhook/playtest"

    def require_n8n_auth(self) -> None:
        if not self.n8n_header_value:
            raise RuntimeError("Configure GB_BRIDGE_N8N_HEADER_VALUE for outbound n8n polling")

    def assert_playtest_webhook_config(self) -> None:
        """Refuse configs that target the sibling LocalAI worker's n8n prefix."""
        prefix_l = self.n8n_webhook_prefix.lower().replace("\\", "/")
        base_l = self.n8n_base_url.lower().replace("\\", "/")
        if "localai" in prefix_l:
            raise RuntimeError(
                "GB_BRIDGE_N8N_WEBHOOK_PREFIX must use /webhook/playtest/*, not localai "
                f"(got {self.n8n_webhook_prefix!r})",
            )
        if "/webhook/localai" in base_l or base_l.rstrip("/").endswith("/localai"):
            raise RuntimeError(
                "GB_BRIDGE_N8N_BASE_URL must not point at /webhook/localai; use playtest webhooks only "
                f"(got {self.n8n_base_url!r})",
            )

    def resolve_antigravity_ledger_path(self) -> Path:
        if self.antigravity_ledger_path.strip():
            return Path(self.antigravity_ledger_path).expanduser()
        if self.antigravity_quota_path.strip():
            return Path(self.antigravity_quota_path).expanduser()
        base = Path(self.state_dir or (Path.home() / ".gb-bridge"))
        return base / "antigravity-ledger.jsonl"

    def resolve_antigravity_quota_path(self) -> Path:
        """Legacy alias for the shared Antigravity call ledger (JSONL)."""
        return self.resolve_antigravity_ledger_path()

    def assert_antigravity_config(self) -> None:
        from gb_bridge.antigravity import assert_antigravity_args_safe

        assert_antigravity_args_safe(self.antigravity_extra_args)
        if self.antigravity_mode not in ("plan", "accept-edits", "auto"):
            raise RuntimeError(f"Invalid GB_BRIDGE_ANTIGRAVITY_MODE: {self.antigravity_mode!r}")

    def validate_startup(self) -> None:
        self.require_n8n_auth()
        self.assert_playtest_webhook_config()
        if self.antigravity_enabled:
            self.assert_antigravity_config()

    def webhook_url(self, suffix: str) -> str:
        base = self.n8n_base_url.rstrip("/")
        prefix = self.n8n_webhook_prefix.rstrip("/")
        path = suffix if suffix.startswith("/") else f"/{suffix}"
        return f"{base}{prefix}{path}"


settings = BridgeSettings()