package tn.esprit.clubhub.Controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.esprit.clubhub.Entity.*;
import tn.esprit.clubhub.Repository.EventFeedbackRepository;
import tn.esprit.clubhub.Repository.EventRepository;
import tn.esprit.clubhub.Repository.RSVPRepository;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Demo-only — generates a small but realistic dataset (past events with
 * varying formats, attendance and feedback) so the AI recommendation
 * widget on the "Add Event" modal has actual signal to work with.
 *
 * <p>All seeded documents are tagged with {@code demoSeed=true} via the
 * createdBy field prefix (or in the title/comment) so they can be wiped
 * clean with a single DELETE.</p>
 *
 * <pre>
 *   POST   /api/seed/demo?count=6   → seed N past events (default 6)
 *   DELETE /api/seed/demo           → remove every demo-seeded doc
 *   GET    /api/seed/status         → quick counts so you know what's there
 * </pre>
 *
 * <strong>Never expose this in production.</strong> It bypasses RBAC by
 * design — the goal is to populate Mongo for a 3-week academic demo.
 */
@Slf4j
@RestController
@RequestMapping("/api/seed")
public class DemoSeedController {

    /** Marker stored in {@code createdBy} so we can wipe demo data later. */
    private static final String DEMO_TAG = "demo-seed";

    @Autowired private EventRepository eventRepository;
    @Autowired private RSVPRepository rsvpRepository;
    @Autowired private EventFeedbackRepository feedbackRepository;

    private static final String[] FORMATS =
            {"workshop", "conference", "training", "networking", "competition", "trip_outing"};
    private static final String[] TITLES_BY_FORMAT = {
            "Atelier React avancé",
            "Conférence Cybersécurité 2026",
            "Training Public Speaking",
            "Soirée Networking Alumni",
            "Hackathon Innovation Sociale",
            "Sortie pédagogique au Musée du Bardo"
    };
    private static final String[] STAFF_ROLES =
            {"formateur", "photographe", "modérateur", "logistique", "communication"};
    private static final String[] STAFF_NAMES =
            {"Ahmed", "Salma", "Karim", "Imen", "Yassine", "Maissa", "Bilel", "Nour"};
    private static final String[] FEEDBACK_TAGS = {
            "well-organized", "engaging-speaker", "useful-content",
            "great-venue", "needs-improvement", "too-long", "good-pace"
    };
    private static final String[] FEEDBACK_COMMENTS = {
            "Excellent contenu, j'ai beaucoup appris.",
            "Bonne ambiance mais la salle était trop petite.",
            "Le speaker maîtrisait bien son sujet.",
            "À refaire avec plus de temps pour les questions.",
            "Très bon networking, j'ai rencontré des gens intéressants.",
            "Format un peu long, prévoir une pause."
    };

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status() {
        long demoEvents = eventRepository.findAll().stream()
                .filter(this::isDemo).count();
        return ResponseEntity.ok(Map.of(
                "demoEventCount", demoEvents,
                "totalEvents",   eventRepository.count(),
                "totalRsvps",    rsvpRepository.count(),
                "totalFeedbacks",feedbackRepository.count()
        ));
    }

    @PostMapping("/demo")
    public ResponseEntity<Map<String, Object>> seed(
            @RequestParam(defaultValue = "6") int count,
            @RequestParam(required = false) String clubId) {

        Random rng = new Random(42); // stable seed → reproducible demo
        List<Event> created = new ArrayList<>();

        for (int i = 0; i < count; i++) {
            String format = FORMATS[i % FORMATS.length];
            String title  = TITLES_BY_FORMAT[i % TITLES_BY_FORMAT.length];

            Event e = new Event();
            e.setTitle(title);
            e.setDescription("Événement de démonstration injecté pour alimenter "
                    + "le moteur de recommandation IA. Format: " + format + ".");
            e.setEventFormat(format);
            // Past dates spaced over the last 3 months. We deliberately spread
            // the day-of-week and the hour so the timing recommender (best
            // day + best slot) has actual signal — workshops/training during
            // weekday afternoons, networking on Friday evenings, conference
            // on Saturday mornings, etc.
            int daysAgo = 7 * (i + 1) + rng.nextInt(3);
            int hour = switch (format) {
                case "workshop", "training" -> 14 + rng.nextInt(3);   // afternoon
                case "conference"           -> 9  + rng.nextInt(2);   // morning
                case "networking"           -> 18 + rng.nextInt(2);   // evening
                case "competition"          -> 10 + rng.nextInt(6);   // mid-day
                default                     -> 15 + rng.nextInt(3);
            };
            LocalDateTime start = LocalDateTime.now()
                    .minusDays(daysAgo)
                    .withHour(hour).withMinute(0).withSecond(0).withNano(0);
            e.setStartDate(start);
            e.setEndDate(start.plusHours(3));
            e.setStatus("completed");
            e.setCapacity(40 + rng.nextInt(60));
            // Note: Event has no clubId column today — these seeded events
            // are picked up by the GLOBAL recommender (which scans every
            // past event regardless of club). clubId param is reserved
            // for when we wire the field into the schema.
            e.setCreatedBy(DEMO_TAG);
            e.setCreatedAt(LocalDateTime.now());
            e.setUpdatedAt(LocalDateTime.now());

            EventLocation loc = new EventLocation();
            loc.setName("Amphi " + (i + 1) + " — Esprit");
            loc.setAddress("Z.I. Cha Cha, Ariana, Tunisie");
            e.setLocation(loc);

            // 2-3 staff members per event with varied roles.
            int staffCount = 2 + rng.nextInt(2);
            List<EventStaffMember> staff = new ArrayList<>();
            for (int s = 0; s < staffCount; s++) {
                staff.add(new EventStaffMember(
                        STAFF_NAMES[(i + s) % STAFF_NAMES.length],
                        STAFF_ROLES[(i + s) % STAFF_ROLES.length],
                        50.0 + rng.nextInt(150)
                ));
            }
            e.setStaff(staff);

            Event saved = eventRepository.save(e);
            created.add(saved);

            // RSVPs — vary attendance per format so the recommender finds a
            // signal: workshops/training fill up, networking is lukewarm.
            int rsvpCount = switch (format) {
                case "workshop", "training" -> 25 + rng.nextInt(15);
                case "conference"           -> 35 + rng.nextInt(20);
                case "competition"          -> 30 + rng.nextInt(20);
                case "networking"           -> 12 + rng.nextInt(10);
                default                     -> 18 + rng.nextInt(10);
            };
            seedRsvps(saved, rsvpCount, rng);

            // Feedback — overall good, but networking gets lower scores so
            // the LLM can recommend AGAINST it.
            int feedbackCount = Math.min(rsvpCount, 8 + rng.nextInt(8));
            seedFeedbacks(saved, feedbackCount, format, rng);
        }

        return ResponseEntity.ok(Map.of(
                "created", created.size(),
                "message", "Demo data seeded. Open the Add Event modal to "
                         + "see the AI recommendation widget pick this up."
        ));
    }

    @DeleteMapping("/demo")
    public ResponseEntity<Map<String, Object>> wipe() {
        List<Event> demo = eventRepository.findAll().stream()
                .filter(this::isDemo).toList();
        for (Event e : demo) {
            rsvpRepository.findAll().stream()
                    .filter(r -> e.getId().equals(r.getEventId()))
                    .forEach(r -> rsvpRepository.deleteById(r.getId()));
            feedbackRepository.findByEventId(e.getId())
                    .forEach(f -> feedbackRepository.deleteById(f.getId()));
            eventRepository.deleteById(e.getId());
        }
        return ResponseEntity.ok(Map.of("removed", demo.size()));
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private void seedRsvps(Event event, int n, Random rng) {
        for (int i = 0; i < n; i++) {
            RSVP r = new RSVP();
            r.setEventId(event.getId());
            r.setUserId(DEMO_TAG + "-user-" + i);
            r.setUserEmail("demo" + i + "@clubhub.test");
            r.setUserName("Demo Member " + i);
            r.setStatus("confirmed");
            r.setRsvpDate(event.getStartDate().minusDays(rng.nextInt(7) + 1));
            r.setScanned(rng.nextDouble() < 0.85); // 85% actually attended
            if (r.isScanned()) r.setScannedAt(event.getStartDate());
            rsvpRepository.save(r);
        }
        event.setRsvpCount(n);
        event.setAttendanceCount((int)(n * 0.85));
        eventRepository.save(event);
    }

    private void seedFeedbacks(Event event, int n, String format, Random rng) {
        for (int i = 0; i < n; i++) {
            EventFeedback f = new EventFeedback();
            f.setEventId(event.getId());
            f.setEventTitle(event.getTitle());
            f.setEventFormat(format);
            f.setUserId(DEMO_TAG + "-user-" + i);
            f.setUserName("Demo Member " + i);

            // Networking gets harsher reviews to give the recommender a
            // genuinely different signal across formats.
            int baseline = "networking".equals(format) ? 3 : 4;
            f.setOrganizationScore(clamp(baseline + jitter(rng), 1, 5));
            f.setContentScore(clamp(baseline + jitter(rng), 1, 5));
            f.setAnimationScore(clamp(baseline + jitter(rng), 1, 5));
            f.setVenueScore(clamp(baseline + jitter(rng), 1, 5));
            f.setScheduleScore(clamp(baseline + jitter(rng), 1, 5));
            f.setNpsLikelihood(clamp(baseline * 2 + jitter(rng), 0, 10));

            // 1-3 random tags
            List<String> tags = new ArrayList<>();
            int tagCount = 1 + rng.nextInt(3);
            for (int t = 0; t < tagCount; t++) {
                tags.add(FEEDBACK_TAGS[rng.nextInt(FEEDBACK_TAGS.length)]);
            }
            f.setTags(tags);

            // Per-staff ratings so the LLM can recommend specific roles.
            Map<String, Integer> staffRatings = new HashMap<>();
            if (event.getStaff() != null) {
                for (EventStaffMember m : event.getStaff()) {
                    staffRatings.put(m.getName() + "|" + m.getRole(),
                            clamp(baseline + jitter(rng), 1, 5));
                }
            }
            f.setStaffRatings(staffRatings);

            if (rng.nextDouble() < 0.6) {
                f.setComment(FEEDBACK_COMMENTS[rng.nextInt(FEEDBACK_COMMENTS.length)]);
            }
            f.setCreatedAt(event.getEndDate().plusDays(1));
            feedbackRepository.save(f);
        }
    }

    private boolean isDemo(Event e) {
        return e.getCreatedBy() != null && e.getCreatedBy().startsWith(DEMO_TAG);
    }

    private int jitter(Random rng) { return rng.nextInt(3) - 1; } // -1, 0, +1
    private int clamp(int v, int min, int max) { return Math.max(min, Math.min(max, v)); }
}
