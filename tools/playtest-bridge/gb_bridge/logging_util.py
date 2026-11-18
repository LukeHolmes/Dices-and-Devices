from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from gb_bridge.config import settings


def _state_dir() -> Path:
    if settings.state_dir:
        return Path(settings.state_dir)
    return Path.home() / ".gb-bridge"


class JsonLineHandler(logging.Handler):
    def __init__(self, path: Path) -> None:
        super().__init__()
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)

    def emit(self, record: logging.LogRecord) -> None:
        row: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "job_id"):
            row["job_id"] = record.job_id
        if hasattr(record, "event"):
            row["event"] = record.event
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row, ensure_ascii=True) + "\n")


def setup_logging() -> logging.Logger:
    log = logging.getLogger("gb_bridge")
    if log.handlers:
        return log
    log.setLevel(logging.INFO)
    stream = logging.StreamHandler(sys.stderr)
    stream.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    log.addHandler(stream)
    log.addHandler(JsonLineHandler(_state_dir() / "worker.jsonl"))
    return log