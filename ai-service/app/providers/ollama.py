"""Ollama provider — calls a locally-installed Ollama daemon via HTTP.

Ollama is installed natively on Windows (no Docker) via
https://ollama.com/download. Once installed it listens on
http://localhost:11434 automatically.

Recommended model for a laptop (CPU/GPU, ~2 GB RAM):
    ollama pull llama3.2:3b

For better quality on a 16 GB machine:
    ollama pull mistral:7b-instruct-q4_K_M
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from .base import Provider, ProviderError

log = logging.getLogger(__name__)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


class OllamaProvider(Provider):
    name = "ollama"

    def __init__(self, base_url: str, model: str, timeout_seconds: int):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout_seconds

    def is_available(self) -> bool:
        try:
            r = httpx.get(f"{self.base_url}/api/tags", timeout=2.0)
            return r.status_code == 200
        except Exception:
            return False

    def generate_text(self, prompt: str, temperature: float = 0.4) -> str:
        return self._complete(prompt, temperature=temperature, force_json=False)

    def generate_json(
        self,
        prompt: str,
        schema_hint: dict[str, Any] | None = None,
        temperature: float = 0.3,
    ) -> Any:
        full = prompt
        if schema_hint:
            full += (
                "\n\nReply with a single valid JSON object only. "
                "No prose, no markdown fences, no explanation. "
                "Match exactly this shape (keys, types):\n"
                f"{json.dumps(schema_hint, ensure_ascii=False)}"
            )
        raw = self._complete(full, temperature=temperature, force_json=True)
        cleaned = _FENCE_RE.sub("", raw).strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            log.warning("Ollama returned non-JSON payload: %s", cleaned[:500])
            raise ProviderError(f"Model did not return valid JSON: {exc}") from exc

    def _complete(self, prompt: str, *, temperature: float, force_json: bool) -> str:
        payload: dict[str, Any] = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if force_json:
            payload["format"] = "json"

        try:
            r = httpx.post(
                f"{self.base_url}/api/generate",
                json=payload,
                timeout=self.timeout,
            )
        except httpx.HTTPError as exc:
            raise ProviderError(f"Ollama unreachable: {exc}") from exc

        if r.status_code != 200:
            raise ProviderError(f"Ollama HTTP {r.status_code}: {r.text[:300]}")

        body = r.json()
        text = body.get("response", "")
        if not text:
            raise ProviderError("Empty response from Ollama")
        return text.strip()
