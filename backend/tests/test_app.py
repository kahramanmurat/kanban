from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_expected_payload() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")

        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "message": "Hello from FastAPI",
        }


def test_unauthenticated_root_redirects_to_login() -> None:
    with TestClient(app) as client:
        response = client.get("/", follow_redirects=False)

        assert response.status_code == 303
        assert response.headers["location"] == "/login"


def test_login_page_serves_html() -> None:
    with TestClient(app) as client:
        response = client.get("/login")

        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]


def test_valid_login_sets_session_and_allows_root() -> None:
    with TestClient(app) as client:
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


def test_invalid_login_is_rejected() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/login",
            json={"username": "user", "password": "wrong"},
        )

        assert response.status_code == 401
        assert response.json() == {"detail": "Invalid credentials."}


def test_logout_clears_the_session() -> None:
    with TestClient(app) as client:
        client.post("/api/login", json={"username": "user", "password": "password"})

        logout_response = client.post("/api/logout")
        assert logout_response.status_code == 200
        assert logout_response.json() == {"authenticated": False}

        board_response = client.get("/", follow_redirects=False)
        assert board_response.status_code == 303
        assert board_response.headers["location"] == "/login"
