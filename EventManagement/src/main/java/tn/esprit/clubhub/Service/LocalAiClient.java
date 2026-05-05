package tn.esprit.clubhub.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Talks to the local Python FastAPI service at {@code ai.local.base-url}
 * (see {@code ai-service/} in the repo).
 *
 * <p>The Python service exposes two kinds of endpoints:</p>
 * <ul>
 *   <li>{@code /v1/custom/*} — our own in-house ML models (scikit-learn
 *       RandomForest recommender + rule-based French PV generator). This
 *       is the <b>Tier 1</b> intelligence of ClubHub and the core
 *       artefact of the PFE.</li>
 *   <li>{@code /v1/generate/*} — a generic LLM bridge forwarding prompts
 *       to Ollama (native install, no Docker). This is the optional
 *       <b>Tier 2</b> fallback when the task is too open-ended for the
 *       custom models.</li>
 * </ul>
 *
 * <p>When the Python service is not running the calls throw
 * {@link AiResponseException} and callers transparently fall back to
 * the deterministic Java templates (Tier 3).</p>
 */
@Service
public class LocalAiClient implements AiClient {

    private static final Logger log = LoggerFactory.getLogger(LocalAiClient.class);

    @Value("${ai.local.base-url:}")
    private String baseUrl;

    @Value("${ai.local.timeout-ms:120000}")
    private int timeoutMs;

    private final ObjectMapper mapper = new ObjectMapper();
    private RestTemplate restTemplate;

    @Override
    public String name() {
        return "local";
    }

    @Override
    public boolean isEnabled() {
        return baseUrl != null && !baseUrl.isBlank();
    }

    @Override
    public String generateText(String prompt) {
        if (!isEnabled()) {
            throw new IllegalStateException("Local AI is not configured (missing ai.local.base-url)");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("prompt", prompt);
        body.put("temperature", 0.4);

        JsonNode resp = post("/v1/generate/text", body);
        String text = resp.path("text").asText("");
        if (text.isBlank()) {
            throw new AiResponseException("Empty response from local AI");
        }
        return text;
    }

    @Override
    public JsonNode generateJson(String prompt, Map<String, Object> schemaHint) {
        if (!isEnabled()) {
            throw new IllegalStateException("Local AI is not configured (missing ai.local.base-url)");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("prompt", prompt);
        body.put("temperature", 0.3);
        if (schemaHint != null && !schemaHint.isEmpty()) {
            body.put("schema_hint", schemaHint);
        }
        JsonNode resp = post("/v1/generate/json", body);
        JsonNode data = resp.path("data");
        if (data.isMissingNode() || data.isNull()) {
            throw new AiResponseException("Local AI returned no data");
        }
        return data;
    }

    // ── Custom in-house models (scikit-learn + rule-based NLP) ──────────
    //
    // These two methods hit /v1/custom/recommend and /v1/custom/pv in the
    // Python service. They are OPTIONAL — callers must treat a null
    // response as "feature unsupported, fall back to the LLM path".
    // Unlike generateText / generateJson, they do NOT take a prompt: they
    // hand over the exact same structured context the LLM would receive
    // so the custom Python models can work on typed data, not text.

    /**
     * Runs the custom scikit-learn recommender on the provided facts.
     *
     * @param facts list of event-summary maps (one per past event), matching
     *              the shape produced by {@code EventAiService.eventFacts}
     * @return the full recommendation payload ready for the Angular widget,
     *         or {@code null} if the call fails. Callers should then fall
     *         back to the LLM / deterministic path.
     */
    public JsonNode recommendFromFacts(List<Map<String, Object>> facts) {
        if (!isEnabled()) return null;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("facts", facts == null ? List.of() : facts);
        try {
            return post("/v1/custom/recommend", body);
        } catch (Exception e) {
            log.warn("Custom recommender call failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Runs the rule-based Python PV builder against the structured event
     * context + the secretary's Q&A answers.
     *
     * @return the French PV text, or {@code null} if the service returned
     *         nothing usable. Callers should then try the LLM or the
     *         built-in Java template.
     */
    public String buildPvFromContext(Map<String, Object> ctx,
                                     List<Map<String, Object>> qaPairs,
                                     String additionalNotes) {
        if (!isEnabled()) return null;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("context", ctx == null ? Map.of() : ctx);
        body.put("qaPairs", qaPairs == null ? List.of() : qaPairs);
        body.put("additionalNotes", additionalNotes == null ? "" : additionalNotes);
        try {
            JsonNode resp = post("/v1/custom/pv", body);
            String text = resp.path("text").asText("");
            return text.isBlank() ? null : text;
        } catch (Exception e) {
            log.warn("Custom PV builder call failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Classifies a list of free-text feedback comments with the in-house
     * Logistic Regression model (TF-IDF + bi-grams). Used by the feedback
     * insights widget on the event page — gives organisers a quick
     * positive / neutral / negative breakdown without going through the LLM.
     *
     * @return the full payload (counts, percentages, per-comment items),
     *         or {@code null} if the AI service is offline or the model
     *         isn't loaded. Callers should hide the widget on null.
     */
    public JsonNode analyzeSentiment(List<String> comments) {
        if (!isEnabled()) return null;
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("comments", comments == null ? List.of() : comments);
        try {
            return post("/v1/custom/sentiment", body);
        } catch (Exception e) {
            log.warn("Custom sentiment call failed: {}", e.getMessage());
            return null;
        }
    }

    // ── internals ────────────────────────────────────────────────────────

    /**
     * When the Python service is simply not running, we keep getting
     * "Connection refused" for every request. Printing the full stack
     * trace each time pollutes the logs and confuses demo sessions —
     * we down-grade these transient network errors to a single-line
     * WARN (once per minute) and still bubble up an exception so the
     * caller can fall back.
     */
    private volatile long lastUnreachableLogNanos = 0L;

    private JsonNode post(String path, Map<String, Object> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);
        String url = baseUrl.replaceAll("/$", "") + path;
        try {
            String json = http().postForObject(url, entity, String.class);
            return mapper.readTree(json == null ? "{}" : json);
        } catch (HttpStatusCodeException e) {
            log.error("Local AI HTTP {} – {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AiResponseException(
                    "Local AI call failed: " + e.getStatusCode(), e);
        } catch (org.springframework.web.client.ResourceAccessException e) {
            // "Connection refused" / read-timeout — the Python service is down.
            // Normal situation (dev/demo), silence it except once per minute.
            long now = System.nanoTime();
            if (now - lastUnreachableLogNanos > 60_000_000_000L) {
                lastUnreachableLogNanos = now;
                log.warn("Local AI service unreachable at {} — falling back (start ai-service/run.ps1 to enable it). Details: {}",
                        baseUrl, e.getMostSpecificCause().getMessage());
            }
            throw new AiResponseException("Local AI unreachable", e);
        } catch (Exception e) {
            log.error("Local AI call failed", e);
            throw new AiResponseException("Local AI call failed", e);
        }
    }

    private RestTemplate http() {
        if (restTemplate == null) {
            org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                    new org.springframework.http.client.SimpleClientHttpRequestFactory();
            factory.setConnectTimeout((int) Duration.ofMillis(timeoutMs).toMillis());
            factory.setReadTimeout((int) Duration.ofMillis(timeoutMs).toMillis());
            restTemplate = new RestTemplate(factory);
        }
        return restTemplate;
    }
}
