package tn.esprit.clubhub.Controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.esprit.clubhub.Entity.Event;
import tn.esprit.clubhub.Entity.EventFeedback;
import tn.esprit.clubhub.Entity.EventStaffMember;
import tn.esprit.clubhub.Repository.EventFeedbackRepository;
import tn.esprit.clubhub.Repository.EventRepository;
import tn.esprit.clubhub.Repository.RSVPRepository;
import tn.esprit.clubhub.Service.EventAiService;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.TextStyle;
import java.util.*;

/**
 * Lightweight on-the-fly recommender for the event organisers.
 *
 * Why no external ML model?
 *   At the volume a single club produces (≤ a few hundred events / year)
 *   a deterministic statistical model is faster, fully explainable to the
 *   user, and avoids any external API dependency. We compute three signals:
 *
 *     1) Format performance   — attendance ratio per event format
 *     2) Staff performance    — average attendance + feedback when present
 *     3) Insights             — short, plain-language observations
 *
 * The score combines (in [0, 100]):
 *     0.45 * attendanceScore   (scanned / capacity)
 *   + 0.25 * rsvpScore         (rsvp / capacity)
 *   + 0.30 * feedbackScore     (composite of dimension averages, normalised)
 *
 * Each item carries a `confidence` label ("low" / "medium" / "high") based
 * on the sample size (number of past events for the format / staff member),
 * so the UI can warn the user about thin data.
 */
@RestController
@RequestMapping("/api/recommendations")
public class EventRecommendationController {

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private RSVPRepository rsvpRepository;

    @Autowired
    private EventFeedbackRepository feedbackRepository;

    @Autowired
    private EventAiService aiService;

    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Returns smart event recommendations.
     *
     * Preference order (each step is a clean fallback of the previous):
     *   1. Custom in-house model — scikit-learn RandomForestRegressor
     *      trained on the club's own events. Fast, explainable, offline.
     *      (source=custom-ml)
     *   2. LLM-powered (local Ollama via AiClientRouter): the model
     *      analyses past events + feedback and returns ranked formats /
     *      staff with plain-language rationales. (source=llm)
     *   3. Deterministic statistical recommender (pure Java, always
     *      available). (source=stats / stats-fallback)
     *
     * Query params:
     *   ?source=stats   → force the deterministic Java computation
     *                     (useful for A/B compare or when everything else
     *                     is unreachable)
     *   ?source=llm     → skip the custom ML model and go straight to the
     *                     LLM path (handy to compare outputs in demos)
     *   ?source=custom  → force the custom ML path; if it fails we still
     *                     fall back to stats (never break the UI)
     */
    @GetMapping("/events")
    public ResponseEntity<Map<String, Object>> recommend(
            @RequestParam(value = "source", required = false) String source) {
        // Custom-only mode (user request): no LLM path.
        if (aiService.isCustomModelEnabled()) {
            JsonNode custom = aiService.generateCustomRecommendations();
            if (custom != null) {
                Map<String, Object> wrapped = mapper.convertValue(custom, LinkedHashMap.class);
                wrapped.putIfAbsent("source", "custom-ml");
                wrapped.putIfAbsent("totalPastEvents", countPastEvents());
                return ResponseEntity.ok(wrapped);
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("source", "custom-unavailable");
        out.put("totalPastEvents", countPastEvents());
        out.put("topFormats", List.of());
        out.put("topStaff", List.of());
        out.put("insights", List.of());
        out.put("suggestedFormat", null);
        out.put("suggestedStaff", List.of());
        out.put("suggestedTiming", null);
        out.put("topTiming", List.of());
        out.put("generatedAt", LocalDateTime.now().toString());
        out.put("emptyState",
                "Custom recommendation is unavailable. Start ai-service and ensure the custom recommender model is loaded.");
        return ResponseEntity.ok(out);
    }

    /**
     * Generates a short marketing-friendly description for a NEW event the
     * user is about to create. Takes title + format hints and returns plain
     * text the frontend can drop straight into the description textarea
     * (the user can edit it freely afterwards).
     *
     * Example call:
     *   GET /api/recommendations/event-description?title=Atelier+React&format=workshop&lang=fr
     *
     * Response: { "description": "...text...", "source": "llm"|"unavailable" }
     */
    @GetMapping("/event-description")
    public ResponseEntity<Map<String, Object>> describe(
            @RequestParam String title,
            @RequestParam(required = false) String format,
            @RequestParam(required = false, defaultValue = "fr") String lang) {

        String draft = aiService.draftEventDescription(title, format, lang);
        Map<String, Object> body = new LinkedHashMap<>();
        if (draft == null || draft.isBlank()) {
            body.put("description", "");
            body.put("source", "unavailable");
            body.put("hint", "AI is disabled or returned no content. Write the description manually.");
            return ResponseEntity.ok(body);
        }
        body.put("description", draft.trim());
        body.put("source", "llm");
        String llmBackend = aiService.llmBackendName();
        body.put("llmBackend", llmBackend);
        body.put("model", llmModelLabel(llmBackend));
        body.put("generatedAt", LocalDateTime.now().toString());
        return ResponseEntity.ok(body);
    }

    /** Maps {@link EventAiService#llmBackendName()} to a stable UI label. */
    private static String llmModelLabel(String backend) {
        if (backend == null) return "none";
        return switch (backend) {
            case "local" -> "ollama-via-python";
            default -> backend;
        };
    }

    private long countPastEvents() {
        return safeList(eventRepository.findPastEvents(LocalDateTime.now())).size();
    }

    private Map<String, Object> recommendDeterministic() {
        LocalDateTime now = LocalDateTime.now();
        List<Event> past = safeList(eventRepository.findPastEvents(now)).stream()
                .filter(e -> !Boolean.TRUE.equals(e.getIsDeleted()))
                .filter(e -> !"cancelled".equalsIgnoreCase(String.valueOf(e.getStatus())))
                .toList();

        Map<String, FormatBucket> formats = new LinkedHashMap<>();
        Map<String, StaffBucket> staffByKey = new LinkedHashMap<>();
        // Aggregates for the "best timing" recommendation: we score each
        // (dayOfWeek, time-window) bucket by attendance + feedback, exactly
        // like formats — then surface the top one as the suggested next slot.
        Map<DayOfWeek, TimingBucket> timingByDay  = new EnumMap<>(DayOfWeek.class);
        Map<String,    TimingBucket> timingByHour = new LinkedHashMap<>();

        for (Event e : past) {
            EventStats stats = statsFor(e);

            String fmtKey = normaliseFormat(e.getEventFormat(), e.getEventFormatCustom());
            FormatBucket fb = formats.computeIfAbsent(fmtKey, FormatBucket::new);
            fb.add(stats);

            if (e.getStaff() != null) {
                for (EventStaffMember s : e.getStaff()) {
                    if (s == null || s.getName() == null || s.getName().isBlank()) continue;
                    String name = s.getName().trim();
                    String role = s.getRole() == null ? "" : s.getRole().trim().toLowerCase();
                    String key  = name + "|" + role;
                    StaffBucket sb = staffByKey.computeIfAbsent(key, k -> new StaffBucket(name, role));
                    sb.add(stats);
                }
            }

            if (e.getStartDate() != null) {
                DayOfWeek dow   = e.getStartDate().getDayOfWeek();
                String   slot   = timeSlotOf(e.getStartDate().toLocalTime());
                timingByDay.computeIfAbsent(dow,  d -> new TimingBucket(d.getDisplayName(TextStyle.FULL, Locale.ENGLISH), null)).add(stats, e.getStartDate());
                timingByHour.computeIfAbsent(slot, k -> new TimingBucket(k, slot)).add(stats, e.getStartDate());
            }
        }

        // Build insights as we go (short, factual, no flowery prose)
        List<String> insights = new ArrayList<>();

        List<Map<String, Object>> topFormats = formats.values().stream()
                .map(FormatBucket::toMap)
                .sorted((a, b) -> Double.compare(score(b), score(a)))
                .limit(4)
                .toList();

        List<Map<String, Object>> topStaff = staffByKey.values().stream()
                .filter(s -> s.totalEvents >= 1)
                .map(StaffBucket::toMap)
                .sorted((a, b) -> Double.compare(score(b), score(a)))
                .limit(4)
                .toList();

        // Insight 1: best format vs worst
        if (formats.size() >= 2) {
            List<FormatBucket> sorted = new ArrayList<>(formats.values());
            sorted.sort((a, b) -> Double.compare(b.attendanceRate(), a.attendanceRate()));
            FormatBucket best  = sorted.get(0);
            FormatBucket worst = sorted.get(sorted.size() - 1);
            if (best.attendanceRate() - worst.attendanceRate() >= 0.10) {
                int diff = (int) Math.round((best.attendanceRate() - worst.attendanceRate()) * 100);
                insights.add(String.format(
                        "%s events attract on average %d%% more attendees than %s events in your club.",
                        cap(best.format), diff, cap(worst.format)));
            }
        }

        // Insight 2: capacity utilisation
        double avgAttendance = past.stream()
                .mapToDouble(e -> statsFor(e).attendanceRate())
                .average().orElse(0);
        if (!past.isEmpty()) {
            int pct = (int) Math.round(avgAttendance * 100);
            if (pct < 50) {
                insights.add("Average attendance across your past events is only " + pct +
                        "% of capacity — consider smaller venues or stronger pre-event reminders.");
            } else if (pct >= 80) {
                insights.add("Average attendance is " + pct +
                        "% of capacity — you can probably scale capacity up for similar formats.");
            }
        }

        // Insight 3: tag signals from feedback
        Map<String, Long> negativeTags = new HashMap<>();
        Map<String, Long> positiveTags = new HashMap<>();
        for (Event e : past) {
            for (EventFeedback f : feedbackRepository.findByEventId(e.getId())) {
                if (f.getTags() == null) continue;
                for (String t : f.getTags()) {
                    boolean negative = t.startsWith("neg:") || t.contains("too-")
                            || t.contains("boring") || t.contains("late") || t.contains("disorganized");
                    if (negative) negativeTags.merge(t, 1L, Long::sum);
                    else positiveTags.merge(t, 1L, Long::sum);
                }
            }
        }
        topTag(negativeTags).ifPresent(t -> insights.add(
                "Recurring negative feedback tag: \"" + t + "\" — worth addressing in your next event."));
        topTag(positiveTags).ifPresent(t -> insights.add(
                "Members consistently praise: \"" + t + "\" — keep doing it."));

        // Suggested next format: highest score with confidence ≥ medium
        String suggestedFormat = topFormats.stream()
                .filter(m -> !"low".equals(m.get("confidence")))
                .findFirst()
                .map(m -> String.valueOf(m.get("format")))
                .orElseGet(() -> topFormats.isEmpty() ? null : String.valueOf(topFormats.get(0).get("format")));

        List<Map<String, Object>> suggestedStaff = topStaff.stream()
                .filter(m -> !"low".equals(m.get("confidence")))
                .limit(3)
                .toList();

        // Best timing: pick top day-of-week and top slot, then build a
        // concrete next date (next occurrence of that day at the typical
        // hour) so the UI can pre-fill the date picker in one click.
        TimingBucket bestDay  = pickTop(timingByDay.values());
        TimingBucket bestSlot = pickTop(timingByHour.values());
        Map<String, Object> suggestedTiming = null;
        if (bestDay != null) {
            DayOfWeek targetDow = DayOfWeek.valueOf(bestDay.label.toUpperCase(Locale.ENGLISH));
            int hour = bestSlot != null ? bestSlot.avgHour() : bestDay.avgHour();
            LocalDate today = LocalDate.now();
            LocalDate next  = today.plusDays((targetDow.getValue() - today.getDayOfWeek().getValue() + 7) % 7);
            if (next.equals(today)) next = next.plusDays(7); // never propose "today"
            LocalDateTime suggestedDate = next.atTime(LocalTime.of(Math.max(8, Math.min(20, hour)), 0));

            suggestedTiming = new LinkedHashMap<>();
            suggestedTiming.put("dayOfWeek",   bestDay.label);                     // "Saturday"
            suggestedTiming.put("timeOfDay",   bestSlot != null ? bestSlot.slot : guessSlot(hour));  // "afternoon"
            suggestedTiming.put("suggestedDate", suggestedDate.toString());        // ISO local datetime
            suggestedTiming.put("typicalHour",  hour);
            suggestedTiming.put("score",        Math.round(bestDay.score()));
            suggestedTiming.put("confidence",   confidenceFor(bestDay.totalEvents));
            suggestedTiming.put("rationale", String.format(
                    "Past %s events drew %d%% attendance on average — your strongest day.",
                    bestDay.label.toLowerCase(Locale.ENGLISH),
                    (int) Math.round(bestDay.attendanceRate() * 100)));
        }

        // Build a flat top-3 timing list so the widget can show alternatives.
        List<Map<String, Object>> topTiming = new ArrayList<>();
        timingByDay.values().stream()
                .sorted((a, b) -> Double.compare(b.score(), a.score()))
                .limit(4)
                .forEach(t -> topTiming.add(t.toMap()));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("totalPastEvents", past.size());
        response.put("topFormats", topFormats);
        response.put("topStaff", topStaff);
        response.put("insights", insights);
        response.put("suggestedFormat", suggestedFormat);
        response.put("suggestedStaff", suggestedStaff);
        response.put("suggestedTiming", suggestedTiming);
        response.put("topTiming", topTiming);
        response.put("generatedAt", LocalDateTime.now().toString());

        if (past.isEmpty()) {
            response.put("emptyState",
                    "Not enough past events to recommend yet. Run a few events and collect attendee feedback to unlock smart suggestions.");
        }
        return response;
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static double score(Map<String, Object> m) {
        Object o = m.get("score");
        return o instanceof Number n ? n.doubleValue() : 0;
    }

    private static Optional<String> topTag(Map<String, Long> map) {
        return map.entrySet().stream()
                .filter(e -> e.getValue() >= 2)
                .max(Map.Entry.comparingByValue())
                .map(e -> e.getKey().replaceFirst("^neg:", ""));
    }

    private static String cap(String s) {
        if (s == null || s.isBlank()) return "Other";
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static <T> List<T> safeList(List<T> in) { return in == null ? List.of() : in; }

    private static String normaliseFormat(String fmt, String custom) {
        String base = fmt == null ? "" : fmt.trim().toLowerCase();
        if (base.isEmpty()) return "unspecified";
        if ("other".equals(base) && custom != null && !custom.isBlank()) {
            return custom.trim().toLowerCase();
        }
        return base;
    }

    private EventStats statsFor(Event e) {
        long rsvp     = rsvpRepository.countByEventIdAndStatus(e.getId(), "confirmed");
        long scanned  = rsvpRepository.countByEventIdAndScannedTrue(e.getId());
        int  capacity = (e.getCapacity() == null || e.getCapacity() <= 0) ? 0 : e.getCapacity();

        Double feedbackComposite = null;
        List<EventFeedback> fbList = feedbackRepository.findByEventId(e.getId());
        if (!fbList.isEmpty()) {
            double sum = 0; int n = 0;
            for (EventFeedback f : fbList) {
                Double c = compositeOf(f);
                if (c != null) { sum += c; n++; }
            }
            if (n > 0) feedbackComposite = sum / n;
        }

        return new EventStats(rsvp, scanned, capacity, feedbackComposite);
    }

    private static Double compositeOf(EventFeedback f) {
        Integer[] dims = { f.getOrganizationScore(), f.getContentScore(),
                           f.getAnimationScore(),    f.getVenueScore(),
                           f.getScheduleScore() };
        double sum = 0; int n = 0;
        for (Integer d : dims) {
            if (d != null) { sum += d; n++; }
        }
        return n == 0 ? null : sum / n; // 1..5
    }

    // ── Inner aggregates ─────────────────────────────────────────────────

    private record EventStats(long rsvp, long scanned, int capacity, Double feedbackComposite) {
        /** "Real" attendance rate: scanned / capacity, falls back to rsvp/capacity. */
        double attendanceRate() {
            if (capacity <= 0) return 0;
            long denominator = capacity;
            long numerator   = scanned > 0 ? scanned : rsvp;
            return Math.min(1.0, numerator * 1.0 / denominator);
        }
        double rsvpRate() {
            return capacity <= 0 ? 0 : Math.min(1.0, rsvp * 1.0 / capacity);
        }
    }

    private static class FormatBucket {
        final String format;
        long totalRsvp, totalScanned, totalCapacity;
        int totalEvents;
        double feedbackSum; int feedbackN;

        FormatBucket(String format) { this.format = format; }

        void add(EventStats s) {
            totalRsvp     += s.rsvp;
            totalScanned  += s.scanned;
            totalCapacity += s.capacity;
            totalEvents++;
            if (s.feedbackComposite != null) {
                feedbackSum += s.feedbackComposite;
                feedbackN++;
            }
        }
        double attendanceRate() {
            if (totalCapacity <= 0) return 0;
            long num = totalScanned > 0 ? totalScanned : totalRsvp;
            return Math.min(1.0, num * 1.0 / totalCapacity);
        }
        double rsvpRate() {
            return totalCapacity <= 0 ? 0 : Math.min(1.0, totalRsvp * 1.0 / totalCapacity);
        }
        Double feedbackAvg() { return feedbackN == 0 ? null : feedbackSum / feedbackN; }

        Map<String, Object> toMap() {
            double att   = attendanceRate();
            double rsvp  = rsvpRate();
            Double fb    = feedbackAvg();
            double fbNorm = fb == null ? 0.6 /* neutral prior */ : (fb - 1) / 4.0;
            double score = Math.round((0.45 * att + 0.25 * rsvp + 0.30 * fbNorm) * 100);

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("format", format);
            m.put("totalEvents", totalEvents);
            m.put("totalAttendees", totalScanned > 0 ? totalScanned : totalRsvp);
            m.put("avgAttendanceRate", Math.round(att * 100) / 100.0);
            m.put("avgRsvpRate", Math.round(rsvp * 100) / 100.0);
            m.put("avgFeedback", fb == null ? null : Math.round(fb * 10) / 10.0);
            m.put("score", score);
            m.put("confidence", confidenceFor(totalEvents));
            return m;
        }
    }

    private static class StaffBucket {
        final String name, role;
        long totalRsvp, totalScanned, totalCapacity;
        int totalEvents;
        double feedbackSum; int feedbackN;

        StaffBucket(String name, String role) { this.name = name; this.role = role; }

        void add(EventStats s) {
            totalRsvp     += s.rsvp;
            totalScanned  += s.scanned;
            totalCapacity += s.capacity;
            totalEvents++;
            if (s.feedbackComposite != null) {
                feedbackSum += s.feedbackComposite;
                feedbackN++;
            }
        }
        double attendanceRate() {
            if (totalCapacity <= 0) return 0;
            long num = totalScanned > 0 ? totalScanned : totalRsvp;
            return Math.min(1.0, num * 1.0 / totalCapacity);
        }

        Map<String, Object> toMap() {
            double att = attendanceRate();
            Double fb  = feedbackN == 0 ? null : feedbackSum / feedbackN;
            double fbNorm = fb == null ? 0.6 : (fb - 1) / 4.0;
            double score = Math.round((0.55 * att + 0.45 * fbNorm) * 100);

            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", name);
            m.put("role", role);
            m.put("totalEvents", totalEvents);
            m.put("avgAttendanceRate", Math.round(att * 100) / 100.0);
            m.put("avgFeedback", fb == null ? null : Math.round(fb * 10) / 10.0);
            m.put("score", score);
            m.put("confidence", confidenceFor(totalEvents));
            return m;
        }
    }

    private static String confidenceFor(int n) {
        if (n >= 5) return "high";
        if (n >= 2) return "medium";
        return "low";
    }

    // ── Timing helpers ────────────────────────────────────────────────────

    /** Bucket past events into 4 wide windows so we have enough samples per slot. */
    private static String timeSlotOf(LocalTime t) {
        int h = t.getHour();
        if (h < 12) return "morning";       // 00:00 → 11:59
        if (h < 17) return "afternoon";     // 12:00 → 16:59
        if (h < 21) return "evening";       // 17:00 → 20:59
        return "night";                     // 21:00 → 23:59
    }

    private static String guessSlot(int hour) {
        if (hour < 12) return "morning";
        if (hour < 17) return "afternoon";
        if (hour < 21) return "evening";
        return "night";
    }

    private static TimingBucket pickTop(Collection<TimingBucket> buckets) {
        return buckets.stream()
                .filter(b -> b.totalEvents >= 1)
                .max(Comparator.comparingDouble(TimingBucket::score))
                .orElse(null);
    }

    /** Aggregates attendance + feedback for one timing dimension (day OR slot). */
    private static class TimingBucket {
        final String label;       // human-readable: "Saturday" or "afternoon"
        final String slot;        // null for day buckets, set for slot buckets
        long totalRsvp, totalScanned, totalCapacity, hourSum;
        int totalEvents;
        double feedbackSum; int feedbackN;

        TimingBucket(String label, String slot) { this.label = label; this.slot = slot; }

        void add(EventStats s, LocalDateTime when) {
            totalRsvp     += s.rsvp;
            totalScanned  += s.scanned;
            totalCapacity += s.capacity;
            totalEvents++;
            if (when != null) hourSum += when.getHour();
            if (s.feedbackComposite != null) {
                feedbackSum += s.feedbackComposite;
                feedbackN++;
            }
        }
        double attendanceRate() {
            if (totalCapacity <= 0) return 0;
            long num = totalScanned > 0 ? totalScanned : totalRsvp;
            return Math.min(1.0, num * 1.0 / totalCapacity);
        }
        double score() {
            Double fb = feedbackN == 0 ? null : feedbackSum / feedbackN;
            double fbNorm = fb == null ? 0.6 : (fb - 1) / 4.0;
            return Math.round((0.6 * attendanceRate() + 0.4 * fbNorm) * 100);
        }
        int avgHour() { return totalEvents == 0 ? 18 : (int) Math.round(hourSum * 1.0 / totalEvents); }

        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("label", label);
            m.put("slot", slot);
            m.put("totalEvents", totalEvents);
            m.put("avgAttendanceRate", Math.round(attendanceRate() * 100) / 100.0);
            m.put("avgHour", avgHour());
            m.put("score", score());
            m.put("confidence", confidenceFor(totalEvents));
            return m;
        }
    }
}
