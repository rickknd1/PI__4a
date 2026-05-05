package tn.esprit.clubhub.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tn.esprit.clubhub.Entity.Event;
import tn.esprit.clubhub.Entity.EventFeedback;
import tn.esprit.clubhub.Entity.EventStaffMember;
import tn.esprit.clubhub.Repository.EventFeedbackRepository;
import tn.esprit.clubhub.Repository.EventRepository;
import tn.esprit.clubhub.Repository.RSVPRepository;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * High-level AI service that bridges our domain data with the LLM.
 *
 * Architecture choice — RAG-style:
 *   The LLM never sees raw user data and never hallucinates statistics.
 *   We:
 *     1. Pull the relevant events / RSVPs / feedbacks from MongoDB
 *     2. Compute per-event aggregates (attendance rate, feedback composite)
 *     3. Render a compact JSON "facts" block that the LLM is told to
 *        reason from
 *     4. Ask the LLM to produce strictly-typed JSON outputs
 *
 * Two public operations:
 *   - {@link #generateEventRecommendations()}: picks best formats / staff
 *     and writes plain-language insights for the next event
 *   - {@link #summarizeFeedback(String)}: turns N raw feedbacks for one
 *     event into an executive summary + recurring themes + action items
 *
 * If the LLM is disabled or the call fails, every method returns null and
 * callers must handle that (typically by serving the deterministic fallback).
 */
@Service
public class EventAiService {

    private static final Logger log = LoggerFactory.getLogger(EventAiService.class);

    // Injected via the @Primary AiClientRouter → LocalAiClient (Ollama).
    // ClubHub has a 100% local stack: no third-party LLM (Gemini/OpenAI/…).
    @Autowired private AiClient llm;
    // Direct handle on the Python service, used for the CUSTOM in-house
    // scikit-learn recommender (no prompt, typed inputs). Stays null-safe
    // when the local AI is not configured.
    @Autowired private LocalAiClient localAi;
    @Autowired private EventRepository eventRepository;
    @Autowired private RSVPRepository rsvpRepository;
    @Autowired private EventFeedbackRepository feedbackRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    public boolean isEnabled() { return llm.isEnabled(); }

    /**
     * Identifier of the Tier-2 LLM route chosen by {@link AiClientRouter}:
     * {@code "local"} (HTTP to the Python service + Ollama) or
     * {@code "none"}. Use this in API responses so the UI / demos can
     * prove which backend actually answered.
     */
    public String llmBackendName() {
        return llm == null ? "none" : llm.name();
    }

    /**
     * Whether the custom scikit-learn recommender is reachable. Used by the
     * controller to prefer it over the LLM path.
     */
    public boolean isCustomModelEnabled() {
        return localAi != null && localAi.isEnabled();
    }

    // ── 0) Custom ML recommendations (no LLM, scikit-learn-powered) ──────

    /**
     * Runs the in-house RandomForest recommender against the club's past
     * events. Returns the same JSON structure as {@link #generateEventRecommendations()}
     * so the controller / frontend can treat both uniformly.
     *
     * <p>We still build the "facts" table here (same helper the LLM path
     * uses) because the Python service expects typed inputs — it does no
     * DB access of its own.</p>
     *
     * @return recommendation payload, or {@code null} if the custom model
     *         is unavailable / there is no usable data (caller should then
     *         try the LLM path or fall back to deterministic stats).
     */
    public JsonNode generateCustomRecommendations() {
        if (!isCustomModelEnabled()) return null;

        LocalDateTime now = LocalDateTime.now();
        List<Event> past = safeList(eventRepository.findPastEvents(now)).stream()
                .filter(e -> !Boolean.TRUE.equals(e.getIsDeleted()))
                .filter(e -> !"cancelled".equalsIgnoreCase(String.valueOf(e.getStatus())))
                .toList();
        if (past.isEmpty()) return null;

        List<Map<String, Object>> facts = past.stream()
                .map(this::eventFacts)
                .toList();

        try {
            return localAi.recommendFromFacts(facts);
        } catch (Exception e) {
            log.warn("Custom recommender failed: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Scores the free-text comments left on a single event with the in-house
     * Logistic Regression sentiment model. Returns the raw JsonNode payload
     * from the Python service ({@code count, positive, neutral, negative,
     * percent*, items[]}) so the caller can pass it straight to the UI.
     *
     * <p>Returns {@code null} when the AI service is offline, the event
     * has no feedbacks, or every feedback row has a blank comment — the
     * controller maps that to a 404-style empty state.</p>
     */
    public JsonNode analyzeFeedbackSentiment(String eventId) {
        if (!isCustomModelEnabled()) return null;

        List<String> comments = feedbackRepository.findByEventId(eventId).stream()
                .map(f -> f.getComment())
                .filter(c -> c != null && !c.isBlank())
                .toList();
        if (comments.isEmpty()) return null;

        return localAi.analyzeSentiment(comments);
    }

    // ── 1) Event recommendations ─────────────────────────────────────────

    /**
     * Asks the local LLM to pick the next-best format / staff and explain why,
     * grounded in the past-events facts we hand over.
     *
     * Returns the parsed JSON tree, or {@code null} on failure.
     */
    public JsonNode generateEventRecommendations() {
        if (!isEnabled()) return null;

        LocalDateTime now = LocalDateTime.now();
        List<Event> past = safeList(eventRepository.findPastEvents(now)).stream()
                .filter(e -> !Boolean.TRUE.equals(e.getIsDeleted()))
                .filter(e -> !"cancelled".equalsIgnoreCase(String.valueOf(e.getStatus())))
                .toList();

        if (past.isEmpty()) return null;

        List<Map<String, Object>> facts = past.stream()
                .map(this::eventFacts)
                .toList();

        String prompt = """
            You are an event-strategy assistant for a university club.
            You are given a JSON array of past events with their attendance,
            scheduling (startDate, dayOfWeek) and attendee feedback. Your job
            is to recommend, for the NEXT event:
              - the best FORMAT (workshop / conference / training / …)
              - the best TIMING (which day of the week + which time-of-day window)
              - the best STAFF to invite
              - useful insights and concrete next actions
            Everything must be strictly grounded in the data — never invent.

            Rules:
              - Use ONLY the data provided. If the dataset is too small, say so
                in `caveats` and lower the confidence values.
              - Confidence values are "low" | "medium" | "high".
              - Insights are short, actionable, plain English (max 18 words each).
              - Score formats / staff / timings on a 0..100 scale that reflects
                attendance and feedback quality combined.
              - Prefer staff who appear in multiple successful events.
              - For `suggestedTiming.suggestedDate`, propose an ISO local date-time
                in the future (next occurrence of the recommended day at the typical
                hour observed in past events). Default hour: 18:00 if unsure.
              - `timeOfDay` is one of: "morning", "afternoon", "evening", "night".

            Past events (JSON):
            """ + toJson(facts);

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("topFormats", "array of { format:string, totalEvents:int, totalAttendees:int, avgAttendanceRate:0..1, avgFeedback:1..5|null, score:0..100, confidence:'low'|'medium'|'high', rationale:string }");
        schema.put("topStaff",   "array of { name:string, role:string, totalEvents:int, avgAttendanceRate:0..1, avgFeedback:1..5|null, score:0..100, confidence:string, rationale:string }");
        schema.put("insights",   "array of strings (3 to 6 short, factual)");
        schema.put("suggestedFormat", "string (best format for next event)");
        schema.put("suggestedStaff",  "array of {name:string, role:string} (top 3 names)");
        schema.put("suggestedTiming", "object { dayOfWeek:string, timeOfDay:'morning'|'afternoon'|'evening'|'night', typicalHour:int(8..22), suggestedDate:'YYYY-MM-DDTHH:mm', score:0..100, confidence:string, rationale:string }");
        schema.put("topTiming", "array of { label:string, slot:string|null, totalEvents:int, avgAttendanceRate:0..1, avgHour:int, score:0..100, confidence:string }");
        schema.put("nextActions", "array of strings (2-4 concrete things to try)");
        schema.put("caveats",     "array of strings (data-quality warnings, can be empty)");

        try {
            return llm.generateJson(prompt, schema);
        } catch (Exception e) {
            log.warn("LLM recommendations failed: {}", e.getMessage());
            return null;
        }
    }

    // ── 1.b) Event description draft ─────────────────────────────────────

    /**
     * Drafts a short, marketing-friendly description for a future event
     * using the title + format hint provided by the organiser, plus a
     * compact summary of past events of the same format (so the wording
     * matches the club's actual experience and doesn't sound generic).
     *
     * Returns plain text (200-400 chars) on success, or null on failure
     * so the caller can surface an "AI unavailable" toast and let the
     * user write the description manually.
     */
    public String draftEventDescription(String title, String format, String language) {
        if (!isEnabled()) return null;
        if (title == null || title.isBlank()) return null;

        String fmt  = format == null ? "" : format.trim().toLowerCase();
        String lang = (language == null || language.isBlank()) ? "fr" : language.trim().toLowerCase();

        // Pull at most 5 past events of the same format to ground the tone.
        List<Map<String, Object>> sameFormatFacts = safeList(eventRepository.findPastEvents(LocalDateTime.now())).stream()
                .filter(e -> !Boolean.TRUE.equals(e.getIsDeleted()))
                .filter(e -> fmt.isBlank() || fmt.equalsIgnoreCase(normaliseFormat(e.getEventFormat(), e.getEventFormatCustom())))
                .limit(5)
                .map(this::eventFacts)
                .toList();

        String prompt = """
            You are a community manager for a university club, writing an
            event teaser. The organiser only gave you a title and a format
            — you must produce a SHORT description (2 to 4 sentences,
            200-400 characters) that sounds like the club's voice.

            Rules:
              - Language: %s ("fr" → French, "en" → English, "ar" → Arabic).
              - Tone: enthusiastic but factual, no marketing fluff, no emojis.
              - Mention the format ONCE if relevant.
              - DO NOT invent attendee numbers, prices, or speaker names.
              - DO NOT start with "Join us" / "Come and …" — find a fresher hook.
              - Output ONLY the description text, no labels, no quotes.

            Inputs:
              title:  %s
              format: %s
              past_same_format_events: %s
            """.formatted(lang, title, fmt.isBlank() ? "(unspecified)" : fmt, toJson(sameFormatFacts));

        try {
            // Plain-text completion — bypass the JSON schema enforcement.
            return llm.generateText(prompt);
        } catch (Exception e) {
            log.warn("LLM description draft failed: {}", e.getMessage());
            return null;
        }
    }

    // ── 2) Feedback summarisation ────────────────────────────────────────

    /**
     * Transforms N raw feedback rows for one event into a structured summary:
     *   - executive_summary (3-4 sentences)
     *   - sentiment ("positive" / "mixed" / "negative") + score 0..100
     *   - dimension_highlights (which dimensions stood out)
     *   - recurring_themes [{ theme, polarity, mentions }]
     *   - praise / pain_points (bullet lists)
     *   - action_items (3-5 concrete actions for the organisers)
     */
    public JsonNode summarizeFeedback(String eventId) {
        if (!isEnabled()) return null;

        Event ev = eventRepository.findById(eventId).orElse(null);
        if (ev == null) return null;

        List<EventFeedback> feedbacks = feedbackRepository.findByEventId(eventId);
        if (feedbacks.isEmpty()) return null;

        Map<String, Object> ctx = new LinkedHashMap<>();
        ctx.put("event", Map.of(
                "title", nullSafe(ev.getTitle()),
                "format", nullSafe(ev.getEventFormat()),
                "capacity", ev.getCapacity() == null ? 0 : ev.getCapacity(),
                "startDate", ev.getStartDate() == null ? null : ev.getStartDate().format(DateTimeFormatter.ISO_DATE),
                "rsvpConfirmed", rsvpRepository.countByEventIdAndStatus(eventId, "confirmed"),
                "scannedAttendees", rsvpRepository.countByEventIdAndScannedTrue(eventId)
        ));
        ctx.put("feedbackCount", feedbacks.size());
        ctx.put("feedbacks", feedbacks.stream().map(this::feedbackForLlm).toList());

        String prompt = """
            You are an analyst summarising attendee feedback for a university
            club event. You receive a JSON object containing the event meta-data
            and a list of feedback entries with multi-dimensional ratings,
            tags and free-text comments.

            Your output must:
              - Be grounded ONLY in the provided feedback.
              - Be honest about negatives — the club uses this to improve.
              - Keep prose tight, in plain English. No marketing fluff.
              - Quote at most one short verbatim phrase per theme (≤ 12 words).
              - When mentions < 2, do NOT promote the theme to "recurring".

            Data:
            """ + toJson(ctx);

        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put("executive_summary", "string (3-4 sentences, max 80 words)");
        schema.put("sentiment", "object { label:'positive'|'mixed'|'negative', score:0..100 }");
        schema.put("dimension_highlights", "array of { dimension:string, average:1..5, comment:string }");
        schema.put("recurring_themes", "array of { theme:string, polarity:'positive'|'negative', mentions:int, sample_quote:string|null }");
        schema.put("praise", "array of strings");
        schema.put("pain_points", "array of strings");
        schema.put("action_items", "array of strings (3-5 concrete and specific)");
        schema.put("would_repeat_signal", "string (one sentence on NPS-style intent)");

        try {
            return llm.generateJson(prompt, schema);
        } catch (Exception e) {
            log.warn("LLM feedback summary failed: {}", e.getMessage());
            return null;
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────

    private Map<String, Object> eventFacts(Event e) {
        long rsvp     = rsvpRepository.countByEventIdAndStatus(e.getId(), "confirmed");
        long scanned  = rsvpRepository.countByEventIdAndScannedTrue(e.getId());
        int  capacity = (e.getCapacity() == null || e.getCapacity() <= 0) ? 0 : e.getCapacity();
        long actual   = scanned > 0 ? scanned : rsvp;
        double rate   = capacity > 0 ? Math.min(1.0, actual * 1.0 / capacity) : 0.0;

        // Aggregated feedback signals (composite + recurring tags)
        List<EventFeedback> fbs = feedbackRepository.findByEventId(e.getId());
        Double feedbackComposite = null;
        Map<String, Long> tagCounts = new HashMap<>();
        if (!fbs.isEmpty()) {
            double sum = 0; int n = 0;
            for (EventFeedback f : fbs) {
                Double c = compositeOf(f);
                if (c != null) { sum += c; n++; }
                if (f.getTags() != null) {
                    for (String t : f.getTags()) tagCounts.merge(t, 1L, Long::sum);
                }
            }
            if (n > 0) feedbackComposite = Math.round((sum / n) * 10.0) / 10.0;
        }

        List<String> staff = new ArrayList<>();
        if (e.getStaff() != null) {
            for (EventStaffMember s : e.getStaff()) {
                if (s == null || s.getName() == null) continue;
                staff.add(s.getName() + (s.getRole() == null || s.getRole().isBlank() ? "" : " (" + s.getRole() + ")"));
            }
        }

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", nullSafe(e.getTitle()));
        m.put("format", normaliseFormat(e.getEventFormat(), e.getEventFormatCustom()));
        m.put("startDate", e.getStartDate() == null ? null : e.getStartDate().format(DateTimeFormatter.ISO_DATE));
        m.put("dayOfWeek", e.getStartDate() == null ? null : e.getStartDate().getDayOfWeek().toString());
        m.put("capacity", capacity);
        m.put("rsvpConfirmed", rsvp);
        m.put("scannedAttendees", scanned);
        m.put("attendanceRate", Math.round(rate * 100) / 100.0);
        m.put("staff", staff);
        m.put("feedbackCount", fbs.size());
        m.put("feedbackComposite", feedbackComposite);
        m.put("topTags", tagCounts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(5)
                .collect(Collectors.toMap(
                        Map.Entry::getKey, Map.Entry::getValue,
                        (a, b) -> a, LinkedHashMap::new)));
        return m;
    }

    private Map<String, Object> feedbackForLlm(EventFeedback f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("organization", f.getOrganizationScore());
        m.put("content",      f.getContentScore());
        m.put("animation",    f.getAnimationScore());
        m.put("venue",        f.getVenueScore());
        m.put("schedule",     f.getScheduleScore());
        m.put("nps",          f.getNpsLikelihood());
        m.put("tags",         f.getTags() == null ? List.of() : f.getTags());
        // Truncate comments to keep prompts cheap
        String c = f.getComment();
        if (c != null && c.length() > 240) c = c.substring(0, 240) + "…";
        m.put("comment", c);
        return m;
    }

    private static Double compositeOf(EventFeedback f) {
        Integer[] dims = { f.getOrganizationScore(), f.getContentScore(),
                           f.getAnimationScore(),    f.getVenueScore(),
                           f.getScheduleScore() };
        double sum = 0; int n = 0;
        for (Integer d : dims) {
            if (d != null) { sum += d; n++; }
        }
        return n == 0 ? null : sum / n;
    }

    private static String normaliseFormat(String fmt, String custom) {
        String base = fmt == null ? "" : fmt.trim().toLowerCase();
        if (base.isEmpty()) return "unspecified";
        if ("other".equals(base) && custom != null && !custom.isBlank()) return custom.trim().toLowerCase();
        return base;
    }

    private static <T> List<T> safeList(List<T> in) { return in == null ? List.of() : in; }
    private static String nullSafe(String s) { return s == null ? "" : s; }

    private String toJson(Object o) {
        try { return mapper.writeValueAsString(o); }
        catch (Exception e) { return "[]"; }
    }
}
