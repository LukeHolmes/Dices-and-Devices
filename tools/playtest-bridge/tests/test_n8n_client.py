import httpx
import pytest

from gb_bridge.config import settings
from gb_bridge.n8n_client import N8nClient


def test_webhook_url_builds():
    settings.n8n_base_url = "http://homeassistant.tailde272c.ts.net:5678"
    settings.n8n_webhook_prefix = "/webhook/playtest"
    assert settings.webhook_url("/poll").endswith("/webhook/playtest/poll")


def test_poll_payload(monkeypatch):
    captured = {}

    class FakeResp:
        status_code = 200
        content = b'{"jobs":[]}'

        def raise_for_status(self):
            return None

        def json(self):
            return {"jobs": []}

    class FakeClient:
        def post(self, url, json):
            captured["url"] = url
            captured["json"] = json
            return FakeResp()

    client = N8nClient(client=FakeClient())  # type: ignore[arg-type]
    client.poll("worker-1")
    assert captured["json"]["worker_id"] == "worker-1"
    client.close()


def test_post_retries_on_http_400_then_succeeds(monkeypatch):
    calls = {"n": 0}

    class FakeResp:
        status_code = 200
        content = b'{"ok":true}'

        def raise_for_status(self):
            return None

        def json(self):
            return {"ok": True}

    class FailResp:
        status_code = 400
        content = b""
        request = httpx.Request("POST", "http://example/poll")

        def raise_for_status(self):
            raise httpx.HTTPStatusError("400", request=self.request, response=self)

    class FakeClient:
        def post(self, url, json):
            calls["n"] += 1
            if calls["n"] == 1:
                return FailResp()
            return FakeResp()

    monkeypatch.setattr("gb_bridge.n8n_client.time.sleep", lambda _s: None)
    client = N8nClient(client=FakeClient())  # type: ignore[arg-type]
    out = client.poll("worker-1")
    assert out == {"ok": True}
    assert calls["n"] == 2
    client.close()


def test_post_retries_on_empty_body(monkeypatch):
    calls = {"n": 0}

    class EmptyResp:
        status_code = 200
        content = b""

        def raise_for_status(self):
            return None

    class GoodResp:
        status_code = 200
        content = b'{"jobs":[]}'

        def raise_for_status(self):
            return None

        def json(self):
            return {"jobs": []}

    class FakeClient:
        def post(self, url, json):
            calls["n"] += 1
            return EmptyResp() if calls["n"] == 1 else GoodResp()

    monkeypatch.setattr("gb_bridge.n8n_client.time.sleep", lambda _s: None)
    client = N8nClient(client=FakeClient())  # type: ignore[arg-type]
    out = client.poll("worker-1")
    assert out == {"jobs": []}
    assert calls["n"] == 2
    client.close()