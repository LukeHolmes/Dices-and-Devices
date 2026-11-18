from gb_bridge.config import BridgeSettings
from gb_bridge.ollama_gate import fetch_ollama_ps, ollama_models_loaded, should_defer_playtest_claim


def test_ollama_models_loaded_empty():
    assert ollama_models_loaded({"models": []}) is False


def test_ollama_models_loaded_present():
    assert ollama_models_loaded({"models": [{"name": "llama3"}]}) is True


def test_should_defer_when_models_running():
    class FakeClient:
        def get(self, url):
            class R:
                def raise_for_status(self):
                    return None

                def json(self):
                    return {"models": [{"name": "mistral"}]}

            return R()

        def close(self):
            return None

    cfg = BridgeSettings(ollama_defer_enabled=True, n8n_header_value="x")
    defer, reason = should_defer_playtest_claim(cfg, client=FakeClient())  # type: ignore[arg-type]
    assert defer is True
    assert reason == "ollama_models_loaded"


def test_should_not_defer_when_disabled():
    class FakeClient:
        def get(self, url):
            class R:
                def raise_for_status(self):
                    return None

                def json(self):
                    return {"models": [{"name": "mistral"}]}

            return R()

        def close(self):
            return None

    cfg = BridgeSettings(ollama_defer_enabled=False, n8n_header_value="x")
    defer, _ = should_defer_playtest_claim(cfg, client=FakeClient())  # type: ignore[arg-type]
    assert defer is False


def test_fetch_ollama_ps_with_inline_client():
    class FakeClient:
        def get(self, url):
            class R:
                def raise_for_status(self):
                    return None

                def json(self):
                    return {"models": []}

            return R()

    data = fetch_ollama_ps("http://127.0.0.1:11434/api/ps", client=FakeClient())  # type: ignore[arg-type]
    assert data == {"models": []}