"""Provider abstraction: every backend (Ollama, template, …) exposes the same
two-method contract so the router can swap them transparently."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class Provider(ABC):
    """A text-generation backend."""

    name: str = "base"

    @abstractmethod
    def is_available(self) -> bool:
        """Cheap probe — should NOT raise. Return False when unreachable."""

    @abstractmethod
    def generate_text(self, prompt: str, temperature: float = 0.4) -> str:
        """Return plain text. Raises on failure."""

    @abstractmethod
    def generate_json(
        self,
        prompt: str,
        schema_hint: dict[str, Any] | None = None,
        temperature: float = 0.3,
    ) -> Any:
        """Return parsed JSON (dict / list). Raises on failure or invalid JSON."""


class ProviderError(RuntimeError):
    """Raised by providers when generation fails in a non-recoverable way."""
