package tn.esprit.clubhub.Service;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.Map;

/**
 * Minimal abstraction over the local LLM backend.
 *
 * <p>The only concrete implementation is {@link LocalAiClient}, which
 * talks to the Python FastAPI service → Ollama. A thin
 * {@link AiClientRouter} sits on top (marked {@code @Primary}) so
 * {@code PvAiService} / {@code EventAiService} can be swapped over to a
 * different backend later without touching their code.</p>
 */
public interface AiClient {

    /** {@code true} when the backend is configured and usable. */
    boolean isEnabled();

    /** Plain-text completion. Throws on any non-recoverable failure. */
    String generateText(String prompt);

    /**
     * JSON-constrained completion. {@code schemaHint} is a loose map of
     * field → type description, appended to the prompt so the model knows
     * the exact shape to return.
     */
    JsonNode generateJson(String prompt, Map<String, Object> schemaHint);

    /** Human-readable identifier for logs / response metadata. */
    String name();
}
