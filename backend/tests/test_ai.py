from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.ai import AIConnectivityError, CONNECTIVITY_PROMPT, run_connectivity_check
from app.main import create_app
from app.settings import DEFAULT_OPENAI_MODEL, get_settings

CSRF = {"X-Requested-With": "fetch"}


def create_client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "pm-test.sqlite3"))
    return TestClient(create_app())


def test_get_settings_reads_openai_configuration(monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.delenv("OPENAI_MODEL", raising=False)

    settings = get_settings()

    assert settings.openai_api_key == "test-key"
    assert settings.openai_model == DEFAULT_OPENAI_MODEL


def test_run_connectivity_check_returns_output_text() -> None:
    class FakeResponses:
        def create(self, *, model: str, input: str) -> SimpleNamespace:
            assert model == DEFAULT_OPENAI_MODEL
            assert input == CONNECTIVITY_PROMPT
            return SimpleNamespace(output_text="4")

    client = SimpleNamespace(responses=FakeResponses())

    result = run_connectivity_check(client, DEFAULT_OPENAI_MODEL)

    assert result.response == "4"
    assert result.model == DEFAULT_OPENAI_MODEL
    assert result.prompt == CONNECTIVITY_PROMPT


def test_run_connectivity_check_rejects_empty_output() -> None:
    class FakeResponses:
        def create(self, *, model: str, input: str) -> SimpleNamespace:
            return SimpleNamespace(output_text="   ")

    client = SimpleNamespace(responses=FakeResponses())

    try:
        run_connectivity_check(client, DEFAULT_OPENAI_MODEL)
    except AIConnectivityError as error:
        assert str(error) == "OpenAI returned an empty response."
    else:
        raise AssertionError("Expected AIConnectivityError for empty output.")


def test_ai_connectivity_route_requires_authentication(tmp_path, monkeypatch) -> None:
    with create_client(tmp_path, monkeypatch) as client:
        response = client.post("/api/ai/connectivity", headers=CSRF)

        assert response.status_code == 401
        assert response.json() == {"detail": "Authentication required."}


def test_ai_connectivity_route_reports_missing_api_key(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "")

    with create_client(tmp_path, monkeypatch) as client:
        client.post("/api/login", json={"username": "user", "password": "password"}, headers=CSRF)
        response = client.post("/api/ai/connectivity", headers=CSRF)

        assert response.status_code == 503
        assert response.json() == {
            "detail": "OPENAI_API_KEY is not configured. Add it to the environment or project root .env file."
        }


def test_ai_connectivity_route_returns_model_output(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    class FakeResponses:
        def create(self, *, model: str, input: str) -> SimpleNamespace:
            assert model == DEFAULT_OPENAI_MODEL
            assert input == CONNECTIVITY_PROMPT
            return SimpleNamespace(output_text="4")

    fake_client = SimpleNamespace(responses=FakeResponses())
    monkeypatch.setattr("app.ai.create_openai_client", lambda api_key: fake_client)

    with create_client(tmp_path, monkeypatch) as client:
        client.post("/api/login", json={"username": "user", "password": "password"}, headers=CSRF)
        response = client.post("/api/ai/connectivity", headers=CSRF)

        assert response.status_code == 200
        assert response.json() == {
            "model": DEFAULT_OPENAI_MODEL,
            "prompt": CONNECTIVITY_PROMPT,
            "response": "4",
        }
