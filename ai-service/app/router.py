"""Selects the active provider based on config, with graceful fallback."""

from __future__ import annotations

import logging
from functools import lru_cache

from .config import Settings, get_settings
from .providers.base import Provider
from .providers.ollama import OllamaProvider
from .providers.template import TemplateProvider

log = logging.getLogger(__name__)


def _build(settings: Settings) -> Provider:
    if settings.provider == "ollama":
        return OllamaProvider(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            timeout_seconds=settings.ollama_timeout_seconds,
        )
    if settings.provider == "template":
        return TemplateProvider()
    log.warning("Unknown AI_PROVIDER=%s — falling back to template", settings.provider)
    return TemplateProvider()


@lru_cache(maxsize=1)
def get_provider() -> Provider:
    return _build(get_settings())
