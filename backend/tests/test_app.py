from fastapi.testclient import TestClient

from app.main import create_app


def create_client(tmp_path, monkeypatch) -> TestClient:
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "pm-test.sqlite3"))
    return TestClient(create_app())


def test_health_returns_expected_payload() -> None:
    with TestClient(create_app()) as client:
        response = client.get("/api/health")

        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "message": "Hello from FastAPI",
        }


def test_unauthenticated_root_redirects_to_login(tmp_path, monkeypatch) -> None:
    with create_client(tmp_path, monkeypatch) as client:
        response = client.get("/", follow_redirects=False)

        assert response.status_code == 303
        assert response.headers["location"] == "/login"


def test_login_page_serves_html(tmp_path, monkeypatch) -> None:
    with create_client(tmp_path, monkeypatch) as client:
        response = client.get("/login")

        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]


def test_valid_login_sets_session_and_allows_root(tmp_path, monkeypatch) -> None:
    with create_client(tmp_path, monkeypatch) as client:
        login_response = client.post(
            "/api/login",
            json={"username": "user", "password": "password"},
        )

        assert login_response.status_code == 200
        assert login_response.json() == {
            "authenticated": True,
            "username": "user",
        }

        board_response = client.get("/")

        assert board_response.status_code == 200
        assert "text/html" in board_response.headers["content-type"]


def test_invalid_login_is_rejected(tmp_path, monkeypatch) -> None:
    with create_client(tmp_path, monkeypatch) as client:
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "wrong"},
        )

        assert response.status_code == 401
        assert response.json() == {"detail": "Invalid credentials."}


def test_logout_clears_the_session(tmp_path, monkeypatch) -> None:
    with create_client(tmp_path, monkeypatch) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})

        logout_response = client.post("/api/logout")
        assert logout_response.status_code == 200
        assert logout_response.json() == {"authenticated": False}

        board_response = client.get("/", follow_redirects=False)
        assert board_response.status_code == 303
        assert board_response.headers["location"] == "/login"


def test_database_is_created_and_seeded(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "pm-test.sqlite3"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(create_app()) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})
        response = client.get("/api/board")

        assert database_path.exists()
        assert response.status_code == 200
        body = response.json()
        assert len(body["columns"]) == 5
        assert len(body["cards"]) == 8
        assert body["columns"][0]["id"] == "col-backlog"


def test_board_api_rejects_unauthenticated_requests(tmp_path, monkeypatch) -> None:
    with create_client(tmp_path, monkeypatch) as client:
        response = client.get("/api/board")

        assert response.status_code == 401
        assert response.json() == {"detail": "Authentication required."}


def test_board_mutation_endpoints_work_for_authenticated_user(tmp_path, monkeypatch) -> None:
    with create_client(tmp_path, monkeypatch) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})

        rename_response = client.patch(
            "/api/columns/col-backlog",
            json={"title": "Ideas"},
        )
        assert rename_response.status_code == 200
        assert rename_response.json()["columns"][0]["title"] == "Ideas"

        create_response = client.post(
            "/api/columns/col-backlog/cards",
            json={"title": "API card", "details": "Created from test."},
        )
        assert create_response.status_code == 200
        board = create_response.json()
        created_card_id = board["columns"][0]["cardIds"][-1]
        assert board["cards"][created_card_id]["title"] == "API card"

        update_response = client.patch(
            f"/api/cards/{created_card_id}",
            json={
                "title": "Updated API card",
                "details": "Moved by test.",
                "columnId": "col-review",
                "position": 0,
            },
        )
        assert update_response.status_code == 200
        updated_board = update_response.json()
        assert updated_board["columns"][3]["cardIds"][0] == created_card_id
        assert updated_board["cards"][created_card_id]["title"] == "Updated API card"

        delete_response = client.delete(f"/api/cards/{created_card_id}")
        assert delete_response.status_code == 200
        deleted_board = delete_response.json()
        assert created_card_id not in deleted_board["cards"]
        assert created_card_id not in deleted_board["columns"][3]["cardIds"]


def test_board_changes_persist_across_app_restarts(tmp_path, monkeypatch) -> None:
    database_path = tmp_path / "pm-test.sqlite3"
    monkeypatch.setenv("DATABASE_PATH", str(database_path))

    with TestClient(create_app()) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})
        response = client.patch("/api/columns/col-review", json={"title": "Ready"})
        assert response.status_code == 200

    with TestClient(create_app()) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})
        board_response = client.get("/api/board")

        assert board_response.status_code == 200
        board = board_response.json()
        review_column = next(column for column in board["columns"] if column["id"] == "col-review")
        assert review_column["title"] == "Ready"


def test_move_from_middle_of_column_succeeds(tmp_path, monkeypatch) -> None:
    with create_client(tmp_path, monkeypatch) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})

        response = client.patch(
            "/api/cards/card-1",
            json={"columnId": "col-progress", "position": 1},
        )

        assert response.status_code == 200
        board = response.json()
        backlog_column = next(column for column in board["columns"] if column["id"] == "col-backlog")
        progress_column = next(column for column in board["columns"] if column["id"] == "col-progress")

        assert backlog_column["cardIds"] == ["card-2"]
        assert progress_column["cardIds"] == ["card-4", "card-1", "card-5"]
