import os
import sys
from pathlib import Path

import pytest


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


@pytest.fixture(autouse=True)
def _set_session_secret(monkeypatch):
    monkeypatch.setenv("SESSION_SECRET", "test-session-secret")
