from gb_bridge import worker
from gb_bridge.config import settings


def test_handle_poll_defers_claim_when_ollama_busy(monkeypatch):
    claims = []

    class FakeClient:
        def claim(self, *a, **k):
            claims.append(a)
            return {"claimed": True}

        def post_results(self, *a, **k):
            return {}

        def post_status(self, *a, **k):
            return {}

        def post_interrupted(self, *a, **k):
            return {}

    class FakeStore:
        def get_by_remote(self, _):
            return None

        def create(self, *a, **k):
            raise AssertionError("create should not run when deferring")

    class FakeExecutor:
        def build_plan(self, payload):
            return {"rids": [0], "replicate": 1, "baseline": "R-main", "max_steps": 100, "parallel": 1}

    sleeps = []
    monkeypatch.setattr(worker, "should_defer_playtest_claim", lambda _cfg: (True, "ollama_models_loaded"))
    monkeypatch.setattr(worker.time, "sleep", lambda s: sleeps.append(s))
    monkeypatch.setattr(settings, "ollama_defer_backoff_sec", 12.5, raising=False)

    worker.handle_poll_message(
        FakeStore(),  # type: ignore[arg-type]
        FakeExecutor(),  # type: ignore[arg-type]
        FakeClient(),  # type: ignore[arg-type]
        "worker-1",
        {"jobs": [{"job_id": "remote-1", "operation": "start_playtest", "payload": {"rids": "0"}}]},
    )
    assert claims == []
    assert sleeps == [12.5]