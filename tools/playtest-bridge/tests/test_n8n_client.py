from gb_bridge.config import settings
from gb_bridge.n8n_client import N8nClient


def test_webhook_url_builds():
    settings.n8n_base_url = "http://homeassistant.tailde272c.ts.net:5678"
    settings.n8n_webhook_prefix = "/webhook/playtest"
    assert settings.webhook_url("/poll").endswith("/webhook/playtest/poll")


def test_poll_payload(monkeypatch):
    captured = {}

    class FakeResp:
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