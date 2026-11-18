"""
Optional localhost-only HTTP shim (OFF by default).

Production laptops should run `python -m gb_bridge.worker` and poll n8n outbound.
Enable only for local debugging: GB_BRIDGE_HTTP_SERVER_ENABLED=1
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from gb_bridge.config import settings
from gb_bridge.jobs import PlaytestExecutor, run_investigate_defect
from gb_bridge.store import JobStore

try:
    from fastapi import Depends, FastAPI, HTTPException
    from pydantic import BaseModel, Field
except ImportError as exc:  # pragma: no cover
    raise RuntimeError("Install optional deps: pip install -e '.[http]'") from exc

DB_PATH = Path.home() / ".gb-bridge" / "jobs.sqlite"
store = JobStore(DB_PATH)
executor = PlaytestExecutor(store)

app = FastAPI(title="Gutterbones Playtest Bridge (optional localhost)", version="0.1.0")


class StartPlaytestRequest(BaseModel):
    baseline: str = "R-main"
    rids: str | list[int] = "0-9"
    policy_revision: str = "2026-11-11-phase-b-v1"
    budget_max_steps: int = 12_000
    parallel: int = 2
    replicate: int = 1
    holdout_approval_id: str = ""


class InvestigateDefectRequest(BaseModel):
    job_id: str
    rid: int
    defect_hypothesis: str
    kind: str = Field(pattern="^(gameplay|measurement)$")


def _bearer_ok(authorization: str | None = None) -> None:
    if not settings.bearer_token:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="unauthorized")
    token = authorization.removeprefix("Bearer ").strip()
    if token != settings.bearer_token:
        raise HTTPException(status_code=401, detail="unauthorized")


@app.post("/mcp/start_playtest")
def start_playtest(req: StartPlaytestRequest, _: None = Depends(_bearer_ok)) -> dict[str, Any]:
    plan = executor.build_plan(req.model_dump())
    job = store.create(plan, total=len(plan["rids"]) * plan["replicate"])
    finished = executor.run_playtest(job, should_cancel=lambda: False)
    return {"job_id": finished.job_id, "status": finished.status, "rid_count": finished.total}


@app.get("/mcp/get_playtest_status")
def get_playtest_status(job_id: str, _: None = Depends(_bearer_ok)) -> dict[str, Any]:
    job = store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job_not_found")
    return {
        "job_id": job.job_id,
        "status": job.status,
        "done": job.done,
        "total": job.total,
        "logs_tail": job.logs[-20:],
        "error": job.error,
    }


@app.post("/mcp/investigate_defect")
def investigate_defect(req: InvestigateDefectRequest, _: None = Depends(_bearer_ok)) -> dict[str, Any]:
    return run_investigate_defect(req.model_dump())