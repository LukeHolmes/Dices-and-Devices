from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_ts(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


@dataclass
class JobRecord:
    job_id: str
    status: str = "QUEUED"
    plan: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=utc_now)
    updated_at: str = field(default_factory=utc_now)
    done: int = 0
    total: int = 0
    logs: list[str] = field(default_factory=list)
    result_path: str = ""
    error: str = ""
    remote_job_id: str = ""
    worker_id: str = ""
    lease_expires_at: str = ""
    operation: str = "start_playtest"
    cancel_requested: bool = False


class JobStore:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._lock = threading.Lock()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(db_path) as con:
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                  job_id TEXT PRIMARY KEY,
                  status TEXT NOT NULL,
                  plan_json TEXT NOT NULL,
                  created_at TEXT NOT NULL,
                  updated_at TEXT NOT NULL,
                  done INTEGER NOT NULL DEFAULT 0,
                  total INTEGER NOT NULL DEFAULT 0,
                  result_path TEXT,
                  error TEXT,
                  logs_json TEXT NOT NULL DEFAULT '[]',
                  remote_job_id TEXT,
                  worker_id TEXT,
                  lease_expires_at TEXT,
                  operation TEXT DEFAULT 'start_playtest',
                  cancel_requested INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            self._ensure_columns(con)
            con.commit()

    @staticmethod
    def _ensure_columns(con: sqlite3.Connection) -> None:
        cols = {row[1] for row in con.execute("PRAGMA table_info(jobs)").fetchall()}
        migrations = {
            "remote_job_id": "ALTER TABLE jobs ADD COLUMN remote_job_id TEXT",
            "worker_id": "ALTER TABLE jobs ADD COLUMN worker_id TEXT",
            "lease_expires_at": "ALTER TABLE jobs ADD COLUMN lease_expires_at TEXT",
            "operation": "ALTER TABLE jobs ADD COLUMN operation TEXT DEFAULT 'start_playtest'",
            "cancel_requested": "ALTER TABLE jobs ADD COLUMN cancel_requested INTEGER NOT NULL DEFAULT 0",
        }
        for name, sql in migrations.items():
            if name not in cols:
                con.execute(sql)

    def create(self, plan: dict[str, Any], total: int, *, remote_job_id: str = "", operation: str = "start_playtest") -> JobRecord:
        job = JobRecord(
            job_id=str(uuid.uuid4()),
            plan=plan,
            total=total,
            remote_job_id=remote_job_id,
            operation=operation,
        )
        with self._lock, sqlite3.connect(self._db_path) as con:
            con.execute(
                """
                INSERT INTO jobs (
                  job_id, status, plan_json, created_at, updated_at, total, logs_json,
                  remote_job_id, operation
                ) VALUES (?,?,?,?,?,?,?,?,?)
                """,
                (
                    job.job_id,
                    job.status,
                    json.dumps(plan),
                    job.created_at,
                    job.updated_at,
                    total,
                    "[]",
                    remote_job_id,
                    operation,
                ),
            )
            con.commit()
        return job

    def get(self, job_id: str) -> Optional[JobRecord]:
        with self._lock, sqlite3.connect(self._db_path) as con:
            row = con.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
        if not row:
            return None
        return self._row_to_job(row)

    def get_by_remote(self, remote_job_id: str) -> Optional[JobRecord]:
        with self._lock, sqlite3.connect(self._db_path) as con:
            row = con.execute("SELECT * FROM jobs WHERE remote_job_id = ?", (remote_job_id,)).fetchone()
        if not row:
            return None
        return self._row_to_job(row)

    def list_running_for_worker(self, worker_id: str) -> list[JobRecord]:
        with self._lock, sqlite3.connect(self._db_path) as con:
            rows = con.execute(
                "SELECT * FROM jobs WHERE worker_id = ? AND status IN ('RUNNING','QUEUED')",
                (worker_id,),
            ).fetchall()
        return [self._row_to_job(row) for row in rows]

    def list_stale_leases(self, worker_id: str) -> list[JobRecord]:
        now = datetime.now(timezone.utc)
        out: list[JobRecord] = []
        with self._lock, sqlite3.connect(self._db_path) as con:
            rows = con.execute(
                "SELECT * FROM jobs WHERE worker_id = ? AND status = 'RUNNING'",
                (worker_id,),
            ).fetchall()
        for row in rows:
            job = self._row_to_job(row)
            if not job.lease_expires_at:
                out.append(job)
                continue
            if parse_ts(job.lease_expires_at) < now:
                out.append(job)
        return out

    def update(self, job: JobRecord) -> None:
        job.updated_at = utc_now()
        with self._lock, sqlite3.connect(self._db_path) as con:
            con.execute(
                """
                UPDATE jobs SET
                  status=?, updated_at=?, done=?, result_path=?, error=?, logs_json=?,
                  remote_job_id=?, worker_id=?, lease_expires_at=?, operation=?, cancel_requested=?
                WHERE job_id=?
                """,
                (
                    job.status,
                    job.updated_at,
                    job.done,
                    job.result_path,
                    job.error,
                    json.dumps(job.logs[-200:]),
                    job.remote_job_id,
                    job.worker_id,
                    job.lease_expires_at,
                    job.operation,
                    1 if job.cancel_requested else 0,
                    job.job_id,
                ),
            )
            con.commit()

    def touch_lease(self, job: JobRecord, lease_sec: int, worker_id: str) -> None:
        expires = datetime.now(timezone.utc) + timedelta(seconds=lease_sec)
        job.lease_expires_at = expires.isoformat()
        job.worker_id = worker_id
        self.update(job)

    @staticmethod
    def _row_to_job(row: tuple[Any, ...]) -> JobRecord:
        keys = [
            "job_id",
            "status",
            "plan_json",
            "created_at",
            "updated_at",
            "done",
            "total",
            "result_path",
            "error",
            "logs_json",
            "remote_job_id",
            "worker_id",
            "lease_expires_at",
            "operation",
            "cancel_requested",
        ]
        data = dict(zip(keys, row[: len(keys)]))
        return JobRecord(
            job_id=data["job_id"],
            status=data["status"],
            plan=json.loads(data["plan_json"]),
            created_at=data["created_at"],
            updated_at=data["updated_at"],
            done=int(data["done"] or 0),
            total=int(data["total"] or 0),
            result_path=data["result_path"] or "",
            error=data["error"] or "",
            logs=json.loads(data["logs_json"] or "[]"),
            remote_job_id=data.get("remote_job_id") or "",
            worker_id=data.get("worker_id") or "",
            lease_expires_at=data.get("lease_expires_at") or "",
            operation=data.get("operation") or "start_playtest",
            cancel_requested=bool(data.get("cancel_requested")),
        )