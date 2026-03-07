import json
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.ai import (
    AIResponseFormatError,
    ConversationMessage,
    MAX_CONVERSATION_MESSAGES,
    build_board_prompt,
    parse_board_response,
)
from app.main import create_app

CSRF = {"X-Requested-With": "fetch"}


def create_client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "pm-test.sqlite3"))
    return TestClient(create_app())


def create_fake_client(*responses: str):
    class FakeResponses:
        def __init__(self, values: tuple[str, ...]) -> None:
            self.values = list(values)
            self.calls: list[dict[str, str]] = []

        def create(self, *, model: str, input: str) -> SimpleNamespace:
            self.calls.append({"model": model, "input": input})
            return SimpleNamespace(output_text=self.values.pop(0))

    fake_responses = FakeResponses(responses)
    return SimpleNamespace(responses=fake_responses), fake_responses


def test_build_board_prompt_includes_board_message_and_history() -> None:
    prompt = build_board_prompt(
        board={
            "columns": [{"id": "col-backlog", "title": "Backlog", "cardIds": []}],
            "cards": {},
        },
        message="Summarize the board.",
        history=[],
    )

    assert "assistantMessage" in prompt
    assert "boardChange" in prompt
    assert "col-backlog" in prompt
    assert "Summarize the board." in prompt


def test_build_board_prompt_limits_history_to_latest_messages() -> None:
    history = [
        ConversationMessage(role="user", content=f"message-{index}")
        for index in range(MAX_CONVERSATION_MESSAGES + 3)
    ]

    prompt = build_board_prompt(
        board={
            "columns": [{"id": "col-backlog", "title": "Backlog", "cardIds": []}],
            "cards": {},
        },
        message="Summarize the board.",
        history=history,
    )

    assert "message-0" not in prompt
    assert f"message-{MAX_CONVERSATION_MESSAGES + 2}" in prompt


def test_parse_board_response_rejects_invalid_payload() -> None:
    try:
        parse_board_response('{"boardChange": null}')
    except AIResponseFormatError as error:
        assert str(error) == "AI returned an invalid board operation payload."
    else:
        raise AssertionError("Expected AIResponseFormatError for invalid payload.")


def test_ai_board_route_requires_authentication(tmp_path, monkeypatch) -> None:
    with create_client(tmp_path, monkeypatch) as client:
        response = client.post(
            "/api/ai/board", json={"message": "Summarize the board."}, headers=CSRF
        )

        assert response.status_code == 401
        assert response.json() == {"detail": "Authentication required."}


def test_ai_board_route_returns_noop_response(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    fake_client, fake_responses = create_fake_client(
        json.dumps(
            {
                "assistantMessage": "The board already looks good, so I left it unchanged.",
                "boardChange": None,
            }
        )
    )
    monkeypatch.setattr("app.ai.create_openai_client", lambda api_key: fake_client)

    with create_client(tmp_path, monkeypatch) as client:
        client.post(
            "/api/login",
            json={"username": "user", "password": "password"},
            headers=CSRF,
        )
        before = client.get("/api/board").json()
        response = client.post(
            "/api/ai/board",
            headers=CSRF,
            json={"message": "Summarize the board without changing it."},
        )

        assert response.status_code == 200
        assert (
            response.json()["assistantMessage"]
            == "The board already looks good, so I left it unchanged."
        )
        assert response.json()["appliedOperations"] == []
        assert response.json()["board"] == before
        assert fake_responses.calls[0]["model"]
        assert (
            "Summarize the board without changing it."
            in fake_responses.calls[0]["input"]
        )


def test_ai_board_route_applies_operations_and_persists_changes(
    tmp_path, monkeypatch
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    fake_client, _ = create_fake_client(
        json.dumps(
            {
                "assistantMessage": "I renamed a column and added a new task.",
                "boardChange": {
                    "operations": [
                        {
                            "type": "rename_column",
                            "columnId": "col-progress",
                            "title": "Building",
                        },
                        {
                            "type": "add_card",
                            "columnId": "col-backlog",
                            "title": "Draft launch FAQ",
                            "details": "Collect the questions support expects after release.",
                        },
                    ]
                },
            }
        )
    )
    monkeypatch.setattr("app.ai.create_openai_client", lambda api_key: fake_client)

    with create_client(tmp_path, monkeypatch) as client:
        client.post(
            "/api/login",
            json={"username": "user", "password": "password"},
            headers=CSRF,
        )
        response = client.post(
            "/api/ai/board",
            headers=CSRF,
            json={
                "message": "Rename In Progress to Building and add a launch FAQ card to Backlog."
            },
        )

        assert response.status_code == 200
        body = response.json()
        progress_column = next(
            column
            for column in body["board"]["columns"]
            if column["id"] == "col-progress"
        )
        backlog_column = next(
            column
            for column in body["board"]["columns"]
            if column["id"] == "col-backlog"
        )

        assert progress_column["title"] == "Building"
        new_card_id = backlog_column["cardIds"][-1]
        assert body["board"]["cards"][new_card_id]["title"] == "Draft launch FAQ"
        assert body["appliedOperations"] == [
            {"type": "rename_column", "columnId": "col-progress", "title": "Building"},
            {
                "type": "add_card",
                "columnId": "col-backlog",
                "title": "Draft launch FAQ",
                "details": "Collect the questions support expects after release.",
            },
        ]

        persisted = client.get("/api/board").json()
        persisted_progress = next(
            column for column in persisted["columns"] if column["id"] == "col-progress"
        )
        assert persisted_progress["title"] == "Building"
        assert (
            new_card_id
            in next(
                column
                for column in persisted["columns"]
                if column["id"] == "col-backlog"
            )["cardIds"]
        )


def test_ai_board_route_moves_card_from_middle_of_source_column(
    tmp_path, monkeypatch
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    fake_client, _ = create_fake_client(
        json.dumps(
            {
                "assistantMessage": "I moved Align roadmap themes into In Progress.",
                "boardChange": {
                    "operations": [
                        {
                            "type": "move_card",
                            "cardId": "card-1",
                            "columnId": "col-progress",
                            "position": 1,
                        }
                    ]
                },
            }
        )
    )
    monkeypatch.setattr("app.ai.create_openai_client", lambda api_key: fake_client)

    with create_client(tmp_path, monkeypatch) as client:
        client.post(
            "/api/login",
            json={"username": "user", "password": "password"},
            headers=CSRF,
        )
        response = client.post(
            "/api/ai/board",
            headers=CSRF,
            json={"message": 'Move "Align roadmap themes" to In Progress.'},
        )

        assert response.status_code == 200
        body = response.json()
        backlog_column = next(
            column
            for column in body["board"]["columns"]
            if column["id"] == "col-backlog"
        )
        progress_column = next(
            column
            for column in body["board"]["columns"]
            if column["id"] == "col-progress"
        )

        assert backlog_column["cardIds"] == ["card-2"]
        assert progress_column["cardIds"] == ["card-4", "card-1", "card-5"]
        assert body["appliedOperations"] == [
            {
                "type": "move_card",
                "cardId": "card-1",
                "columnId": "col-progress",
                "position": 1,
            }
        ]


def test_ai_board_route_rejects_malformed_model_output(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    fake_client, _ = create_fake_client("not json at all")
    monkeypatch.setattr("app.ai.create_openai_client", lambda api_key: fake_client)

    with create_client(tmp_path, monkeypatch) as client:
        client.post(
            "/api/login",
            json={"username": "user", "password": "password"},
            headers=CSRF,
        )
        before = client.get("/api/board").json()
        response = client.post(
            "/api/ai/board",
            headers=CSRF,
            json={"message": "Make up something invalid."},
        )

        assert response.status_code == 502
        assert response.json() == {"detail": "AI returned invalid JSON."}
        assert client.get("/api/board").json() == before


def test_ai_board_route_rolls_back_on_invalid_operation_sequence(
    tmp_path, monkeypatch
) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    fake_client, _ = create_fake_client(
        json.dumps(
            {
                "assistantMessage": "I tried to rename a column and delete a card.",
                "boardChange": {
                    "operations": [
                        {
                            "type": "rename_column",
                            "columnId": "col-review",
                            "title": "Ready",
                        },
                        {
                            "type": "delete_card",
                            "cardId": "card-missing",
                        },
                    ]
                },
            }
        )
    )
    monkeypatch.setattr("app.ai.create_openai_client", lambda api_key: fake_client)

    with create_client(tmp_path, monkeypatch) as client:
        client.post(
            "/api/login",
            json={"username": "user", "password": "password"},
            headers=CSRF,
        )
        before = client.get("/api/board").json()
        response = client.post(
            "/api/ai/board",
            headers=CSRF,
            json={"message": "Rename Review and then delete a missing card."},
        )

        assert response.status_code == 502
        assert response.json() == {"detail": "Card 'card-missing' was not found."}
        assert client.get("/api/board").json() == before


def test_ai_board_route_rejects_excessive_history(tmp_path, monkeypatch) -> None:
    with create_client(tmp_path, monkeypatch) as client:
        client.post(
            "/api/login",
            json={"username": "user", "password": "password"},
            headers=CSRF,
        )
        response = client.post(
            "/api/ai/board",
            headers=CSRF,
            json={
                "message": "Summarize the board.",
                "history": [
                    {"role": "user", "content": f"message-{index}"}
                    for index in range(MAX_CONVERSATION_MESSAGES + 1)
                ],
            },
        )

        assert response.status_code == 422
