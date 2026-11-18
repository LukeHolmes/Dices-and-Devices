from pathlib import Path

from gb_bridge.store import JobStore


def test_job_store_roundtrip(tmp_path: Path):
    store = JobStore(tmp_path / "jobs.sqlite")
    job = store.create({"baseline": "R-main"}, total=3)
    updated = store.get(job.job_id)
    assert updated is not None
    assert updated.total == 3