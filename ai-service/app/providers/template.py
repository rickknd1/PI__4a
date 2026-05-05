"""Template provider — deterministic, rules-based fallback.

Used when Ollama is not installed/running. It does NOT understand natural
language, so:
  - generate_text returns a lightly-formatted version of the prompt itself
    (good enough for the Java side to recognise a degraded state).
  - generate_json refuses to pretend it can answer — raises ProviderError.

The Java backend already has deterministic fallbacks for both PV generation
(PvAiService.fallbackTemplate) and recommendations (EventRecommendationController.recommendDeterministic),
so template-mode here just forwards the failure upwards.
"""

from __future__ import annotations

from typing import Any

from .base import Provider, ProviderError


class TemplateProvider(Provider):
    name = "template"

    def is_available(self) -> bool:
        return True

    def generate_text(self, prompt: str, temperature: float = 0.4) -> str:
        raise ProviderError(
            "No LLM configured — the Java backend will use its built-in template fallback."
        )

    def generate_json(
        self,
        prompt: str,
        schema_hint: dict[str, Any] | None = None,
        temperature: float = 0.3,
    ) -> Any:
        raise ProviderError(
            "No LLM configured — the Java backend will use its built-in template fallback."
        )
