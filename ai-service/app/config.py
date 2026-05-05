"""Runtime configuration pulled from environment / .env file."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    provider: str
    ollama_base_url: str
    ollama_model: str
    ollama_timeout_seconds: int
    fallback_on_llm_error: bool
    host: str
    port: int
    custom_models_enabled: bool
    custom_recommender_model_path: str


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        provider=os.getenv("AI_PROVIDER", "ollama").strip().lower(),
        ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/"),
        ollama_model=os.getenv("OLLAMA_MODEL", "llama3.2:3b"),
        ollama_timeout_seconds=int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120")),
        fallback_on_llm_error=_bool("FALLBACK_ON_LLM_ERROR", True),
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8000")),
        custom_models_enabled=_bool("CUSTOM_MODELS_ENABLED", True),
        custom_recommender_model_path=os.getenv(
            "CUSTOM_RECOMMENDER_MODEL_PATH",
            "app/custom/models/recommender.pkl",
        ),
    )
