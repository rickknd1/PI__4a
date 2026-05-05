package tn.esprit.clubhub.Controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.esprit.clubhub.Entity.Event;
import tn.esprit.clubhub.Entity.EventFeedback;
import tn.esprit.clubhub.Repository.EventFeedbackRepository;
import tn.esprit.clubhub.Repository.EventRepository;
import tn.esprit.clubhub.Security.SessionService;
import tn.esprit.clubhub.Security.SessionUser;
import tn.esprit.clubhub.Service.EventAiService;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/feedbacks")
public class EventFeedbackController {

    @Autowired
    private EventFeedbackRepository feedbackRepository;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private EventAiService aiService;

    @Autowired
    private SessionService sessionService;

    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Submit (or update) a feedback for an event on behalf of the *connected
     * user*. One feedback per (event, user) — re-posting from the same user
     * updates their previous answer instead of duplicating.
     *
     * Identity (userId, name) is taken from the session — the body is only
     * trusted for the actual ratings (organisation, animation, …).
     */
    @PostMapping
    public ResponseEntity<?> submitFeedback(@RequestBody EventFeedback body,
                                            HttpServletRequest request) {
        SessionUser me = sessionService.currentUser(request);
        if (me == null || !me.isComplete()) {
            return ResponseEntity.status(401).body(Map.of("error", "Sign in to submit feedback."));
        }

        if (body.getEventId() == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "eventId is required"));
        }

        // Force the identity to the connected user — never trust client input here
        body.setUserId(me.id());
        body.setUserName(me.fullName());

        Optional<Event> evOpt = eventRepository.findById(body.getEventId());
        if (evOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("error", "Event not found"));
        }
        Event ev = evOpt.get();

        body.setEventTitle(ev.getTitle());
        body.setEventFormat(ev.getEventFormat());

        EventFeedback toSave = feedbackRepository
                .findFirstByEventIdAndUserIdOrderByCreatedAtDesc(body.getEventId(), me.id())
                .orElse(body);

        if (toSave != body) {
            toSave.setOrganizationScore(body.getOrganizationScore());
            toSave.setContentScore(body.getContentScore());
            toSave.setAnimationScore(body.getAnimationScore());
            toSave.setVenueScore(body.getVenueScore());
            toSave.setScheduleScore(body.getScheduleScore());
            toSave.setNpsLikelihood(body.getNpsLikelihood());
            toSave.setTags(body.getTags());
            toSave.setStaffRatings(body.getStaffRatings());
            toSave.setComment(body.getComment());
            toSave.setUserName(me.fullName());
            toSave.setEventTitle(ev.getTitle());
            toSave.setEventFormat(ev.getEventFormat());
        } else {
            toSave.setCreatedAt(LocalDateTime.now());
        }

        EventFeedback saved = feedbackRepository.save(toSave);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/event/{eventId}")
    public ResponseEntity<List<EventFeedback>> byEvent(@PathVariable String eventId) {
        return ResponseEntity.ok(feedbackRepository.findByEventId(eventId));
    }

    @GetMapping("/event/{eventId}/me")
    public ResponseEntity<?> myFeedback(@PathVariable String eventId, @RequestParam String userId) {
        return feedbackRepository
                .findFirstByEventIdAndUserIdOrderByCreatedAtDesc(eventId, userId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.ok(Map.of("exists", false)));
    }

    /**
     * Lightweight aggregated summary for a single event:
     * average per dimension + tag frequency + composite score.
     */
    @GetMapping("/event/{eventId}/summary")
    public ResponseEntity<Map<String, Object>> summary(@PathVariable String eventId) {
        List<EventFeedback> all = feedbackRepository.findByEventId(eventId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("count", all.size());

        result.put("organization", avg(all, EventFeedback::getOrganizationScore));
        result.put("content",      avg(all, EventFeedback::getContentScore));
        result.put("animation",    avg(all, EventFeedback::getAnimationScore));
        result.put("venue",        avg(all, EventFeedback::getVenueScore));
        result.put("schedule",     avg(all, EventFeedback::getScheduleScore));
        result.put("nps",          avg(all, EventFeedback::getNpsLikelihood));

        // Tag frequency (top 8)
        Map<String, Long> tagCounts = new HashMap<>();
        for (EventFeedback f : all) {
            if (f.getTags() == null) continue;
            for (String t : f.getTags()) {
                tagCounts.merge(t, 1L, Long::sum);
            }
        }
        List<Map<String, Object>> topTags = tagCounts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(8)
                .map(e -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("tag", e.getKey());
                    m.put("count", e.getValue());
                    return m;
                })
                .toList();
        result.put("topTags", topTags);

        return ResponseEntity.ok(result);
    }

    /**
     * LLM-powered executive summary of all the feedback rows for one event.
     *
     * Output shape:
     *   { executive_summary, sentiment{label,score}, dimension_highlights[],
     *     recurring_themes[], praise[], pain_points[], action_items[],
     *     would_repeat_signal }
     *
     * Returns 503 with `{ enabled:false }` if the LLM isn't configured, and
     * 404 if the event has no feedbacks yet — letting the frontend show the
     * right empty state rather than an error.
     */
    @GetMapping("/event/{eventId}/ai-summary")
    public ResponseEntity<Map<String, Object>> aiSummary(@PathVariable String eventId) {
        if (!aiService.isEnabled()) {
            return ResponseEntity.status(503).body(Map.of(
                    "enabled", false,
                    "message", "AI summary is not configured. Start the local ai-service (run.ps1) to enable it."
            ));
        }

        long count = feedbackRepository.countByEventId(eventId);
        if (count == 0) {
            return ResponseEntity.status(404).body(Map.of(
                    "feedbackCount", 0,
                    "message", "No feedback yet for this event."
            ));
        }

        JsonNode summary = aiService.summarizeFeedback(eventId);
        if (summary == null) {
            return ResponseEntity.status(502).body(Map.of(
                    "error", "AI summary unavailable right now — please retry."
            ));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("eventId", eventId);
        body.put("feedbackCount", count);
        body.put("source", "llm");
        String llmBackend = aiService.llmBackendName();
        body.put("llmBackend", llmBackend);
        body.put("model", llmModelLabel(llmBackend));
        body.put("generatedAt", LocalDateTime.now().toString());
        body.put("summary", summary);
        return ResponseEntity.ok(body);
    }

    /**
     * Custom-ML sentiment breakdown for an event's feedback comments.
     * Uses the in-house Logistic Regression classifier (TF-IDF + bi-grams)
     * — NOT the LLM. Cheap, deterministic, runs offline.
     *
     * Returns:
     *   200 with the scoring payload on success
     *   404 if the event has no feedback comments yet
     *   503 if the AI service / sentiment model isn't available
     */
    @GetMapping("/event/{eventId}/sentiment")
    public ResponseEntity<Map<String, Object>> sentiment(@PathVariable String eventId) {
        if (!aiService.isCustomModelEnabled()) {
            return ResponseEntity.status(503).body(Map.of(
                    "enabled", false,
                    "message", "Sentiment classifier unavailable. Start ai-service/run.ps1 to enable it."
            ));
        }

        long count = feedbackRepository.countByEventId(eventId);
        if (count == 0) {
            return ResponseEntity.status(404).body(Map.of(
                    "feedbackCount", 0,
                    "message", "No feedback yet for this event."
            ));
        }

        JsonNode result = aiService.analyzeFeedbackSentiment(eventId);
        if (result == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "feedbackCount", count,
                    "commentCount", 0,
                    "message", "No free-text comments to analyse yet."
            ));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("eventId", eventId);
        body.put("source", "custom-ml");
        body.put("model", "LogisticRegression + TF-IDF (scikit-learn)");
        body.put("generatedAt", LocalDateTime.now().toString());
        // Merge the Python payload at the top level so the UI gets a flat shape.
        Iterator<Map.Entry<String, JsonNode>> it = result.fields();
        while (it.hasNext()) {
            Map.Entry<String, JsonNode> e = it.next();
            // Don't let "source"/"model" from Python overwrite the ones above.
            if ("source".equals(e.getKey()) || "model".equals(e.getKey())) continue;
            body.put(e.getKey(), mapper.convertValue(e.getValue(), Object.class));
        }
        return ResponseEntity.ok(body);
    }

    private static String llmModelLabel(String backend) {
        if (backend == null) return "none";
        return switch (backend) {
            case "local" -> "ollama-via-python";
            default -> backend;
        };
    }

    private static Double avg(List<EventFeedback> list,
                              java.util.function.Function<EventFeedback, Integer> getter) {
        double sum = 0;
        int n = 0;
        for (EventFeedback f : list) {
            Integer v = getter.apply(f);
            if (v != null) { sum += v; n++; }
        }
        if (n == 0) return null;
        return Math.round((sum / n) * 10.0) / 10.0;
    }
}
