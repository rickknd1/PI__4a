package tn.esprit.clubhub.Controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.esprit.clubhub.Entity.Event;
import tn.esprit.clubhub.Entity.MeetingPv;
import tn.esprit.clubhub.Repository.EventRepository;
import tn.esprit.clubhub.Repository.MeetingPvRepository;
import tn.esprit.clubhub.Security.SessionService;
import tn.esprit.clubhub.Security.SessionUser;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Notification feed for the bell icon in the header.
 *
 * <p>Notifications are computed on-the-fly from the current state of the
 * domain rather than stored in their own collection — this keeps the
 * data model simple while staying perfectly fresh (no cron, no cache to
 * invalidate when an event flips to "completed").</p>
 *
 * <p>Returned notification shape (kept stable for the frontend):
 * <pre>
 * { id, type, title, message, link, severity, createdAt, ageLabel }
 * </pre>
 * - {@code type}    — pv-pending | pv-overdue | …
 * - {@code severity}— info | warning | success
 * - {@code link}    — frontend route to navigate on click
 * - {@code ageLabel}— pre-formatted "5 min", "2 h", "3 j" for the UI
 * </p>
 */
@Slf4j
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired private SessionService sessionService;
    @Autowired private EventRepository eventRepository;
    @Autowired private MeetingPvRepository pvRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> feed(HttpServletRequest request) {
        SessionUser me = sessionService.currentUser(request);
        if (me == null) {
            return ResponseEntity.ok(Map.of(
                    "items", List.of(),
                    "unread", 0
            ));
        }

        List<Map<String, Object>> items = new ArrayList<>();

        // ── SECRETAIRE_GENERALE: one notif per completed event needing a PV
        if ("SECRETAIRE_GENERALE".equalsIgnoreCase(me.role())) {
            items.addAll(buildPvNotifications());
        }

        // Newest first.
        items.sort((a, b) -> {
            String x = (String) a.get("createdAt");
            String y = (String) b.get("createdAt");
            if (x == null && y == null) return 0;
            if (x == null) return 1;
            if (y == null) return -1;
            return y.compareTo(x);
        });

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", items);
        body.put("unread", items.size());
        return ResponseEntity.ok(body);
    }

    // ── Notification builders ──────────────────────────────────────────────

    private List<Map<String, Object>> buildPvNotifications() {
        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> out = new ArrayList<>();

        for (Event e : eventRepository.findAll()) {
            if (Boolean.TRUE.equals(e.getIsDeleted())) continue;
            if (pvRepository.existsByEventId(e.getId())) continue;
            if (!isElapsed(e, now)) continue;

            LocalDateTime when = e.getEndDate() != null ? e.getEndDate() : e.getStartDate();
            long hoursAgo = when == null ? 0 : ChronoUnit.HOURS.between(when, now);

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id",       "pv-" + e.getId());
            item.put("type",     hoursAgo > 72 ? "pv-overdue" : "pv-pending");
            item.put("severity", hoursAgo > 72 ? "warning" : "info");
            item.put("title",    "PV à rédiger");
            item.put("message",  "L'événement « " + nullSafe(e.getTitle())
                                + " » est terminé. Rédigez son procès-verbal.");
            item.put("link",     "/pv");
            item.put("createdAt", when == null ? now.toString() : when.toString());
            item.put("ageLabel",  ageLabel(when, now));
            out.add(item);
        }
        return out;
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private boolean isElapsed(Event e, LocalDateTime now) {
        if ("completed".equalsIgnoreCase(e.getStatus())
                || "ended".equalsIgnoreCase(e.getStatus())
                || "finished".equalsIgnoreCase(e.getStatus())) return true;
        if (e.getEndDate() != null)   return e.getEndDate().isBefore(now);
        if (e.getStartDate() != null) return e.getStartDate().isBefore(now);
        return false;
    }

    private String ageLabel(LocalDateTime when, LocalDateTime now) {
        if (when == null) return "à l'instant";
        long minutes = ChronoUnit.MINUTES.between(when, now);
        if (minutes < 1)   return "à l'instant";
        if (minutes < 60)  return minutes + " min";
        long hours = minutes / 60;
        if (hours < 24)    return "il y a " + hours + " h";
        long days = hours / 24;
        if (days < 30)     return "il y a " + days + " j";
        long months = days / 30;
        return "il y a " + months + " mois";
    }

    private String nullSafe(String s) { return s == null ? "" : s; }
}
