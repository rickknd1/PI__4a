package tn.esprit.clubhub.Controller;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.esprit.clubhub.Entity.Event;
import tn.esprit.clubhub.Entity.MeetingPv;
import tn.esprit.clubhub.Repository.EventRepository;
import tn.esprit.clubhub.Repository.MeetingPvRepository;
import tn.esprit.clubhub.Security.SessionService;
import tn.esprit.clubhub.Security.SessionUser;
import tn.esprit.clubhub.Service.EventContextService;
import tn.esprit.clubhub.Service.PvAiService;
import tn.esprit.clubhub.Service.PvPdfService;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * REST endpoints for the SECRETAIRE_GENERALE "Procès-Verbal" workflow.
 *
 * <pre>
 * GET    /api/pv/pending            → events that ended without a PV yet
 * GET    /api/pv/questions          → default Q&A list (frontend can extend)
 * POST   /api/pv/generate           → ask the AI pipeline to draft a PV (no save)
 * POST   /api/pv                    → persist a (possibly edited) PV
 * GET    /api/pv                    → history (newest first)
 * GET    /api/pv/{id}               → single PV
 * GET    /api/pv/{id}/pdf           → download styled PDF
 * DELETE /api/pv/{id}               → delete from history
 * </pre>
 *
 * <p>All write endpoints resolve the secretary identity from the JWT —
 * the client never sends {@code secretaryId} in the body.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/pv")
public class MeetingPvController {

    @Autowired private MeetingPvRepository pvRepository;
    @Autowired private EventRepository eventRepository;
    @Autowired private PvAiService pvAiService;
    @Autowired private PvPdfService pvPdfService;
    @Autowired private SessionService sessionService;
    @Autowired private EventContextService eventContextService;

    /**
     * Default questions — kept here so the frontend stays in sync.
     *
     * <p>Questions are ordered the same way the PV will read: Préambule
     * (logistics), Déroulement (what happened that day), Décisions, Plan
     * d'action, Clôture. Each Y/N question has an OPTIONAL free-text
     * explanation that the wizard reveals only when the secretary picks
     * "non" — the AI will then quote that explanation verbatim instead of
     * guessing why things went wrong.</p>
     */
    private static final List<Map<String, String>> DEFAULT_QUESTIONS = List.of(
            // ── PRÉAMBULE ───────────────────────────────────────────────
            yn("préambule", "started_on_time",
                    "L'événement a-t-il démarré à l'heure prévue ?"),
            yn("préambule", "venue_ok",
                    "Le lieu initialement prévu a-t-il été utilisé ?"),
            yn("préambule", "staff_complete",
                    "Toute l'équipe encadrante prévue était-elle présente ?"),

            // ── DÉROULEMENT ─────────────────────────────────────────────
            yn("déroulement", "agenda_respected",
                    "Le programme/ordre du jour a-t-il été respecté ?"),
            yn("déroulement", "attendance_satisfactory",
                    "Le taux de présence a-t-il été conforme aux attentes ?"),
            yn("déroulement", "atmosphere_positive",
                    "L'ambiance générale a-t-elle été positive ?"),
            txt("déroulement", "incidents",
                    "Incidents, retards ou points de blocage à signaler (laisser vide si aucun)"),

            // ── DÉCISIONS ───────────────────────────────────────────────
            yn("décisions", "decisions_taken",
                    "Des décisions formelles ont-elles été prises pendant l'événement ?"),
            txt("décisions", "decisions_detail",
                    "Si oui, listez les décisions actées (une par ligne)"),

            // ── PLAN D'ACTION ───────────────────────────────────────────
            yn("plan d'action", "tasks_completed",
                    "Toutes les tâches prévues ont-elles été menées à bien ?"),
            txt("plan d'action", "follow_up",
                    "Actions de suivi à mener et responsables (une par ligne)"),

            // ── CLÔTURE ─────────────────────────────────────────────────
            yn("clôture", "budget_respected",
                    "Le budget prévisionnel a-t-il été respecté ?"),
            yn("clôture", "borrowed_returned",
                    "Le matériel emprunté a-t-il été restitué intact ?"),
            yn("clôture", "will_repeat",
                    "Recommandez-vous de reconduire ce type d'événement ?"),
            txt("clôture", "free_remarks",
                    "Autres remarques que vous souhaitez voir apparaître dans le PV")
    );

    private static Map<String, String> yn(String section, String id, String label) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("section", section); m.put("id", id); m.put("label", label); m.put("type", "yesno");
        return m;
    }
    private static Map<String, String> txt(String section, String id, String label) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("section", section); m.put("id", id); m.put("label", label); m.put("type", "text");
        return m;
    }

    /**
     * Returns the structured questions used by the wizard. Kept under the
     * legacy {@code /questions} path so older clients still get something
     * usable (they just see the labels).
     */
    @GetMapping("/questions")
    public ResponseEntity<Map<String, Object>> getDefaultQuestions() {
        return ResponseEntity.ok(Map.of(
                "questions", DEFAULT_QUESTIONS.stream()
                        .map(q -> q.get("label"))
                        .toList(),
                "structured", DEFAULT_QUESTIONS
        ));
    }

    /**
     * Snapshot of real numbers we know about an event (RSVPs, tasks,
     * borrowed material, feedback…). Used by the wizard to display a
     * read-only "données réelles" panel before the secretary answers.
     */
    @GetMapping("/event-context/{eventId}")
    public ResponseEntity<?> getEventContext(@PathVariable String eventId) {
        Optional<Event> e = eventRepository.findById(eventId);
        if (e.isEmpty()) return ResponseEntity.status(404)
                .body(Map.of("error", "Event not found."));
        return ResponseEntity.ok(eventContextService.buildContext(e.get()));
    }

    /**
     * Events eligible for a PV: either they were explicitly marked
     * {@code status=completed}, OR their end date is already in the past
     * (or even the start date if no end date was set). Excludes events
     * that already have a PV.
     */
    @GetMapping("/pending")
    public ResponseEntity<List<Map<String, Object>>> pending() {
        LocalDateTime now = LocalDateTime.now();
        List<Map<String, Object>> result = new ArrayList<>();

        for (Event e : eventRepository.findAll()) {
            if (Boolean.TRUE.equals(e.getIsDeleted())) continue;
            if (pvRepository.existsByEventId(e.getId())) continue;
            if (!isElapsed(e, now)) continue;

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("eventId", e.getId());
            row.put("title",   e.getTitle());
            // Best-effort end date: prefer endDate, fall back to startDate so
            // the UI can still display *something* for incomplete records.
            LocalDateTime when = e.getEndDate() != null ? e.getEndDate() : e.getStartDate();
            row.put("endDate", when == null ? null : when.toString());
            row.put("status",  e.getStatus());
            row.put("location", e.getLocation() != null ? e.getLocation().getName() : null);
            result.add(row);
        }
        // Newest first so the secretary tackles the freshest events.
        result.sort((a, b) -> {
            String x = (String) a.get("endDate");
            String y = (String) b.get("endDate");
            if (x == null && y == null) return 0;
            if (x == null) return 1;
            if (y == null) return -1;
            return y.compareTo(x);
        });
        return ResponseEntity.ok(result);
    }

    /** True when the event has clearly run its course. */
    private boolean isElapsed(Event e, LocalDateTime now) {
        // Status takes priority — an organiser may close the event manually.
        if ("completed".equalsIgnoreCase(e.getStatus())
                || "ended".equalsIgnoreCase(e.getStatus())
                || "finished".equalsIgnoreCase(e.getStatus())) {
            return true;
        }
        if (e.getEndDate() != null) return e.getEndDate().isBefore(now);
        // No endDate? Treat the event as elapsed once startDate has passed
        // (covers single-day events created without an explicit end).
        if (e.getStartDate() != null) return e.getStartDate().isBefore(now);
        return false;
    }

    /** Generate a draft PV WITHOUT persisting it — used by the wizard preview. */
    @PostMapping("/generate")
    public ResponseEntity<?> generateDraft(@RequestBody Map<String, Object> body,
                                           HttpServletRequest request) {
        SessionUser me = sessionService.currentUser(request);
        if (me == null) return ResponseEntity.status(401)
                .body(Map.of("error", "Authentication required."));

        String eventId = (String) body.get("eventId");
        if (eventId == null) return ResponseEntity.badRequest()
                .body(Map.of("error", "eventId is required."));

        Optional<Event> eOpt = eventRepository.findById(eventId);
        if (eOpt.isEmpty()) return ResponseEntity.status(404)
                .body(Map.of("error", "Event not found."));

        List<MeetingPv.QaPair> pairs = parseQaPairs(body.get("qaPairs"));
        String notes = body.get("additionalNotes") == null ? null
                : body.get("additionalNotes").toString();

        String draft = pvAiService.generate(eOpt.get(), pairs, notes);
        return ResponseEntity.ok(Map.of(
                "generatedContent", draft,
                "sourceLanguage", body.getOrDefault("sourceLanguage", "fr")
        ));
    }

    /** Persist a (possibly user-edited) PV. */
    @PostMapping
    public ResponseEntity<?> save(@RequestBody Map<String, Object> body,
                                  HttpServletRequest request) {
        SessionUser me = sessionService.currentUser(request);
        if (me == null) return ResponseEntity.status(401)
                .body(Map.of("error", "Authentication required."));

        String eventId = (String) body.get("eventId");
        String content = (String) body.get("generatedContent");
        if (eventId == null || content == null || content.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "eventId and generatedContent are required."));
        }

        Optional<Event> eOpt = eventRepository.findById(eventId);
        if (eOpt.isEmpty()) return ResponseEntity.status(404)
                .body(Map.of("error", "Event not found."));

        Event event = eOpt.get();
        MeetingPv pv = new MeetingPv();
        pv.setEventId(eventId);
        pv.setEventTitle(event.getTitle());
        pv.setEventDate(event.getStartDate() == null ? null
                : event.getStartDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
        pv.setSecretaryId(me.id());
        pv.setSecretaryName(me.fullName());
        pv.setQaPairs(parseQaPairs(body.get("qaPairs")));
        pv.setAdditionalNotes((String) body.get("additionalNotes"));
        pv.setGeneratedContent(content);
        pv.setSourceLanguage((String) body.getOrDefault("sourceLanguage", "fr"));
        LocalDateTime now = LocalDateTime.now();
        pv.setCreatedAt(now);
        pv.setUpdatedAt(now);

        MeetingPv saved = pvRepository.save(pv);
        return ResponseEntity.ok(saved);
    }

    @GetMapping
    public ResponseEntity<List<MeetingPv>> list() {
        return ResponseEntity.ok(pvRepository.findAllByOrderByCreatedAtDesc());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        return pvRepository.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.status(404)
                        .body(Map.of("error", "PV not found.")));
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<?> downloadPdf(@PathVariable String id) {
        Optional<MeetingPv> pvOpt = pvRepository.findById(id);
        if (pvOpt.isEmpty()) return ResponseEntity.status(404)
                .body(Map.of("error", "PV not found."));
        try {
            byte[] pdf = pvPdfService.render(pvOpt.get());
            String filename = "PV_" + safeName(pvOpt.get().getEventTitle()) + ".pdf";
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdf);
        } catch (Exception e) {
            log.error("PDF render failed for PV {}", id, e);
            return ResponseEntity.status(500)
                    .body(Map.of("error", "Failed to render PDF: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id,
                                    HttpServletRequest request) {
        SessionUser me = sessionService.currentUser(request);
        if (me == null) return ResponseEntity.status(401)
                .body(Map.of("error", "Authentication required."));
        if (!pvRepository.existsById(id)) return ResponseEntity.status(404)
                .body(Map.of("error", "PV not found."));
        pvRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true));
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private List<MeetingPv.QaPair> parseQaPairs(Object raw) {
        List<MeetingPv.QaPair> out = new ArrayList<>();
        if (!(raw instanceof List<?> list)) return out;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> map)) continue;
            MeetingPv.QaPair pair = new MeetingPv.QaPair();
            pair.setQuestion(Objects.toString(map.get("question"), ""));
            pair.setAnswer(Objects.toString(map.get("answer"), ""));
            pair.setQuestionId(map.get("questionId") == null ? null : map.get("questionId").toString());
            pair.setType(map.get("type") == null ? "text" : map.get("type").toString());
            pair.setSection(map.get("section") == null ? null : map.get("section").toString());
            pair.setExplanation(map.get("explanation") == null ? null : map.get("explanation").toString());
            out.add(pair);
        }
        return out;
    }

    private String safeName(String s) {
        if (s == null || s.isBlank()) return "evenement";
        return s.replaceAll("[^A-Za-z0-9._-]+", "_");
    }
}
