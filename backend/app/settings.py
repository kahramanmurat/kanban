import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parents[1]
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None
    openai_model: str


def _load_env() -> None:
    load_dotenv(PROJECT_ROOT / ".env", override=False)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_env()

    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
    )
