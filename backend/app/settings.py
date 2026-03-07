import os
from dataclasses import dataclass
from functools import lru_cache

DEFAULT_OPENAI_MODEL = "gpt-5-mini"


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None
    openai_model: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL),
    )
