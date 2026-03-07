import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


BACKEND_ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("SESSION_SECRET", "test-session-secret")

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    from app.settings import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def create_client(tmp_path, monkeypatch) -> TestClient:
    from app.main import create_app

    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "pm-test.sqlite3"))
    return TestClient(create_app())
