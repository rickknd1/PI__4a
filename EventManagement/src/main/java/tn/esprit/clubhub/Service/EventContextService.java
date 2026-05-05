package tn.esprit.clubhub.Service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tn.esprit.clubhub.Entity.*;
import tn.esprit.clubhub.Repository.BorrowedItemRepository;
import tn.esprit.clubhub.Repository.EventFeedbackRepository;
import tn.esprit.clubhub.Repository.RSVPRepository;
import tn.esprit.clubhub.Repository.TaskRepository;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Aggregates everything we know about a finished {@link Event} so the
 * SECRETAIRE_GENERALE PV wizard can show real numbers (attendance, tasks,
 * borrowed items, feedback ratings, comments) and the LLM can weave them
 * into narrative paragraphs instead of generic placeholders.
 *
 * <p>All fields are best-effort: the service swallows missing data and
 * returns sensible defaults (0, empty list, "Non précisé") so the PV is
 * always renderable even on incomplete records.</p>
 */
@Slf4j
@Service
public class EventContextService {

    @Autowired private RSVPRepository rsvpRepo;
    @Autowired private EventFeedbackRepository feedbackRepo;
    @Autowired private TaskRepository taskRepo;
    @Autowired private BorrowedItemRepository borrowRepo;

    /** Top-level snapshot used by the controller and the LLM. */
    public Map<String, Object> buildContext(Event event) {
        if (event == null) return Map.of();

        Map<String, Object> ctx = new LinkedHashMap<>();
        ctx.put("eventId", event.getId());
        ctx.put("title", nz(event.getTitle()));
        ctx.put("description", nz(event.getDescription()));
        ctx.put("status", nz(event.getStatus()));
        ctx.put("format", nz(event.getEventFormat()));
        ctx.put("calendar", nz(event.getCalendar()));
        ctx.put("capacity", event.getCapacity() == null ? 0 : event.getCapacity());

        // ── Schedule ─────────────────────────────────────────────────────
        ctx.put("startDate", fmt(event.getStartDate()));
        ctx.put("endDate", fmt(event.getEndDate()));
        ctx.put("durationMinutes", durationMinutes(event));

        // ── Location ─────────────────────────────────────────────────────
        Map<String, Object> loc = new LinkedHashMap<>();
        if (event.getLocation() != null) {
            loc.put("name", nz(event.getLocation().getName()));
            loc.put("address", nz(event.getLocation().getAddress()));
        } else {
            loc.put("name", "Non précisé");
            loc.put("address", "");
        }
        ctx.put("location", loc);

        // ── Staff (planned) ──────────────────────────────────────────────
        ctx.put("staff", buildStaff(event));

        // ── Attendance ───────────────────────────────────────────────────
        ctx.put("attendance", buildAttendance(event));

        // ── Tasks ────────────────────────────────────────────────────────
        ctx.put("tasks", buildTasks(event));

        // ── Borrowed items ───────────────────────────────────────────────
        ctx.put("borrowedItems", buildBorrowed(event));

        // ── Feedback ─────────────────────────────────────────────────────
        ctx.put("feedback", buildFeedback(event));

        return ctx;
    }

    // ── Sub-builders ─────────────────────────────────────────────────────

    private List<Map<String, Object>> buildStaff(Event event) {
        if (event.getStaff() == null) return List.of();
        return event.getStaff().stream()
                .filter(Objects::nonNull)
                .map(s -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name", nz(s.getName()));
                    row.put("role", nz(s.getRole()));
                    row.put("budget", s.getBudget() == null ? 0.0 : s.getBudget());
                    return row;
                })
                .collect(Collectors.toList());
    }

    private Map<String, Object> buildAttendance(Event event) {
        Map<String, Object> a = new LinkedHashMap<>();
        try {
            long confirmed = rsvpRepo.countByEventIdAndStatus(event.getId(), "confirmed");
            long checkedIn = rsvpRepo.countByEventIdAndScannedTrue(event.getId());
            long total = rsvpRepo.findByEventId(event.getId()).size();

            a.put("confirmed", confirmed);
            a.put("checkedIn", checkedIn);
            a.put("totalRsvps", total);
            a.put("noShows", Math.max(0, confirmed - checkedIn));

            int cap = event.getCapacity() == null ? 0 : event.getCapacity();
            a.put("capacity", cap);
            a.put("fillRatePct", cap > 0 ? Math.round(confirmed * 100.0 / cap) : 0);
            a.put("attendanceRatePct",
                    confirmed > 0 ? Math.round(checkedIn * 100.0 / confirmed) : 0);
        } catch (Exception e) {
            log.warn("EventContext: attendance aggregation failed: {}", e.getMessage());
            a.putIfAbsent("confirmed", 0L);
            a.putIfAbsent("checkedIn", 0L);
            a.putIfAbsent("totalRsvps", 0L);
            a.putIfAbsent("noShows", 0L);
            a.putIfAbsent("capacity", 0);
            a.putIfAbsent("fillRatePct", 0L);
            a.putIfAbsent("attendanceRatePct", 0L);
        }
        return a;
    }

    private Map<String, Object> buildTasks(Event event) {
        Map<String, Object> t = new LinkedHashMap<>();
        try {
            List<Task> tasks = taskRepo.findByEventId(event.getId());
            int total = tasks.size();
            long done = tasks.stream().filter(x -> "done".equalsIgnoreCase(x.getStatus())).count();
            long inProgress = tasks.stream().filter(x -> "in_progress".equalsIgnoreCase(x.getStatus())).count();
            long todo = tasks.stream().filter(x -> "todo".equalsIgnoreCase(x.getStatus())).count();
            long success = tasks.stream().filter(x -> "success".equalsIgnoreCase(x.getCompletionOutcome())).count();
            long partial = tasks.stream().filter(x -> "partial".equalsIgnoreCase(x.getCompletionOutcome())).count();
            long skipped = tasks.stream().filter(x -> "skipped".equalsIgnoreCase(x.getCompletionOutcome())).count();

            t.put("total", total);
            t.put("done", done);
            t.put("inProgress", inProgress);
            t.put("todo", todo);
            t.put("success", success);
            t.put("partial", partial);
            t.put("skipped", skipped);
            t.put("completionRatePct", total > 0 ? Math.round(done * 100.0 / total) : 0);

            List<Map<String, Object>> highlights = tasks.stream()
                    .filter(x -> x.getCompletionNote() != null && !x.getCompletionNote().isBlank())
                    .limit(5)
                    .map(x -> {
                        Map<String, Object> row = new LinkedHashMap<>();
                        row.put("title", nz(x.getTitle()));
                        row.put("assignee", nz(x.getAssigneeName()));
                        row.put("outcome", nz(x.getCompletionOutcome()));
                        row.put("note", nz(x.getCompletionNote()));
                        return row;
                    })
                    .collect(Collectors.toList());
            t.put("highlights", highlights);
        } catch (Exception e) {
            log.warn("EventContext: task aggregation failed: {}", e.getMessage());
        }
        return t;
    }

    private Map<String, Object> buildBorrowed(Event event) {
        Map<String, Object> b = new LinkedHashMap<>();
        try {
            List<BorrowedItem> items = borrowRepo.findByEventId(event.getId());
            b.put("count", items.size());
            b.put("items", items.stream().limit(10).map(this::borrowedRow)
                    .collect(Collectors.toList()));
        } catch (Exception e) {
            log.warn("EventContext: borrowed-items aggregation failed: {}", e.getMessage());
            b.put("count", 0);
            b.put("items", List.of());
        }
        return b;
    }

    /** Reflective row builder: BorrowedItem fields vary across the codebase. */
    private Map<String, Object> borrowedRow(BorrowedItem item) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", reflectStr(item, "getItemName", "getName", "getTitle"));
        row.put("lender", reflectStr(item, "getLenderName", "getLender", "getOwnerName"));
        row.put("status", reflectStr(item, "getStatus"));
        return row;
    }

    private Map<String, Object> buildFeedback(Event event) {
        Map<String, Object> f = new LinkedHashMap<>();
        try {
            List<EventFeedback> list = feedbackRepo.findByEventId(event.getId());
            int n = list.size();
            f.put("count", n);

            f.put("avgOrganization", avg(list, EventFeedback::getOrganizationScore));
            f.put("avgContent",      avg(list, EventFeedback::getContentScore));
            f.put("avgAnimation",    avg(list, EventFeedback::getAnimationScore));
            f.put("avgVenue",        avg(list, EventFeedback::getVenueScore));
            f.put("avgSchedule",     avg(list, EventFeedback::getScheduleScore));
            f.put("avgNps",          avg(list, EventFeedback::getNpsLikelihood));

            // Top tags
            Map<String, Long> tagCounts = list.stream()
                    .filter(x -> x.getTags() != null)
                    .flatMap(x -> x.getTags().stream())
                    .filter(Objects::nonNull)
                    .collect(Collectors.groupingBy(s -> s, Collectors.counting()));
            List<Map<String, Object>> topTags = tagCounts.entrySet().stream()
                    .sorted((x, y) -> Long.compare(y.getValue(), x.getValue()))
                    .limit(5)
                    .map(e -> {
                        Map<String, Object> r = new LinkedHashMap<>();
                        r.put("tag", e.getKey());
                        r.put("count", e.getValue());
                        return r;
                    })
                    .collect(Collectors.toList());
            f.put("topTags", topTags);

            // Keep a representative sample of comments for AI/PV sentiment.
            // Limiting to 5 over-biases the narrative when the first comments
            // happen to be all positive.
            List<String> comments = list.stream()
                    .map(EventFeedback::getComment)
                    .filter(c -> c != null && !c.isBlank())
                    .limit(30)
                    .map(c -> c.length() > 240 ? c.substring(0, 240) + "…" : c)
                    .collect(Collectors.toList());
            f.put("comments", comments);
        } catch (Exception e) {
            log.warn("EventContext: feedback aggregation failed: {}", e.getMessage());
            f.put("count", 0);
        }
        return f;
    }

    // ── Tiny helpers ─────────────────────────────────────────────────────

    private static String nz(String s) { return s == null ? "" : s; }

    private static String fmt(LocalDateTime t) {
        return t == null ? "" : t.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
    }

    private static long durationMinutes(Event e) {
        if (e.getStartDate() == null || e.getEndDate() == null) return 0L;
        return Math.max(0, Duration.between(e.getStartDate(), e.getEndDate()).toMinutes());
    }

    private static double avg(List<EventFeedback> list,
                              java.util.function.Function<EventFeedback, Integer> getter) {
        return list.stream()
                .map(getter)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .average()
                .stream()
                .map(d -> Math.round(d * 10.0) / 10.0)
                .findFirst()
                .orElse(0.0);
    }

    /** Try several getter names — returns the first non-blank string found. */
    private static String reflectStr(Object obj, String... methodNames) {
        if (obj == null) return "";
        for (String name : methodNames) {
            try {
                Object v = obj.getClass().getMethod(name).invoke(obj);
                if (v != null && !v.toString().isBlank()) return v.toString();
            } catch (NoSuchMethodException ignored) {
                // try next
            } catch (Exception e) {
                // method exists but failed — give up on this name
            }
        }
        return "";
    }
}
