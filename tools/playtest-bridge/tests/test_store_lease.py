from pathlib import Path

from gb_bridge.store import JobStore


def test_touch_lease_updates_expiry(tmp_path: Path):
    store = JobStore(tmp_path / "jobs.sqlite")
    job = store.create({"baseline": "R-main"}, total=1, remote_job_id="remote-1")
    store.touch_lease(job, 120, "worker-a")
    loaded = store.get(job.job_id)
    assert loaded is not None
    assert loaded.worker_id == "worker-a"
    assert loaded.lease_expires_at