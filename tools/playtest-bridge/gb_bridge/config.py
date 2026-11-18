from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    antigravity_daily_limit: int = 3
    antigravity_weekly_limit: int = 10
    antigravity_cli: str = "agy"

    request_timeout_sec: float = 45.0

    def require_n8n_auth(self) -> None:
        if not self.n8n_header_value:
            raise RuntimeError("Configure GB_BRIDGE_N8N_HEADER_VALUE for outbound n8n polling")

    def webhook_url(self, suffix: str) -> str:
        base = self.n8n_base_url.rstrip("/")
        prefix = self.n8n_webhook_prefix.rstrip("/")
        path = suffix if suffix.startswith("/") else f"/{suffix}"
        return f"{base}{prefix}{path}"


settings = BridgeSettings()