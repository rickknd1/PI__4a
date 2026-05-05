package tn.esprit.clubhub.Service;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Single entry point for any Tier-2 LLM call in ClubHub.
 *
 * <p>ClubHub runs a <b>100% local</b> AI stack: the only backend this
 * router knows about is the Python FastAPI service ({@link LocalAiClient})
 * which itself bridges to Ollama. Third-party APIs (Gemini, OpenAI, …)
 * are intentionally not wired in.</p>
 *
 * <p>The router is marked {@link Primary} so any {@code @Autowired AiClient}
 * in the codebase receives this bean rather than the concrete
 * {@link LocalAiClient}. When the local service is unreachable the router
 * lets the exception bubble up so callers
 * ({@code EventAiService}, {@code PvAiService}) can fall back to their
 * deterministic Tier-3 Java templates.</p>
 *
 * <p>The {@code ai.provider} property is kept for backwards compatibility
 * and observability:</p>
 * <ul>
 *     <li>{@code local} (default) — route to {@link LocalAiClient}.</li>
 *     <li>{@code none}            — disable Tier 2 entirely; callers go
 *                                   straight to Tier 3.</li>
 * </ul>
 */
@Service
@Primary
public class AiClientRouter implements AiClient {

    private static final Logger log = LoggerFactory.getLogger(AiClientRouter.class);

    @Autowired private LocalAiClient local;

    @Value("${ai.provider:local}")
    private String provider;

    @PostConstruct
    void announce() {
        log.info("AI router configured: provider={} (local={}) — 100% local stack, no third-party LLM",
                normalized(), local.isEnabled());
    }

    @Override
    public String name() {
        return isTier2Disabled() ? "none" : local.name();
    }

    @Override
    public boolean isEnabled() {
        return !isTier2Disabled() && local.isEnabled();
    }

    @Override
    public String generateText(String prompt) {
        ensureEnabled();
        return local.generateText(prompt);
    }

    @Override
    public JsonNode generateJson(String prompt, Map<String, Object> schemaHint) {
        ensureEnabled();
        return local.generateJson(prompt, schemaHint);
    }

    // ── helpers ─────────────────────────────────────────────────────────

    private void ensureEnabled() {
        if (isTier2Disabled()) {
            throw new IllegalStateException(
                    "Tier-2 LLM is disabled (ai.provider=none). Callers must use Tier-3 fallback.");
        }
        if (!local.isEnabled()) {
            throw new IllegalStateException(
                    "Local AI is not configured (ai.local.base-url is blank).");
        }
    }

    private boolean isTier2Disabled() {
        return "none".equals(normalized());
    }

    private String normalized() {
        return provider == null ? "local" : provider.trim().toLowerCase();
    }
}
