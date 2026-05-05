package tn.esprit.clubhub.Controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import tn.esprit.clubhub.DTO.RSVPResponseDTO;
import tn.esprit.clubhub.Entity.Event;
import tn.esprit.clubhub.Entity.RSVP;
import tn.esprit.clubhub.Repository.EventRepository;
import tn.esprit.clubhub.Repository.RSVPRepository;
import tn.esprit.clubhub.Security.SessionService;
import tn.esprit.clubhub.Security.SessionUser;
import tn.esprit.clubhub.Service.EmailService;
import tn.esprit.clubhub.Service.QrCodeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.annotation.PostConstruct;
import org.springframework.transaction.annotation.Transactional;
import lombok.extern.slf4j.Slf4j;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
@Slf4j
@RestController
@RequestMapping("/api/rsvp")
public class RsvpController {

    @Autowired
    private RSVPRepository rsvpRepository;

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private QrCodeService qrCodeService;

    @Autowired
    private EmailService emailService;

    @Autowired
    private SessionService sessionService;

    /**
     * Public-facing base URL used to build the QR target embedded in the
     * confirmation email. When set (e.g. APP_PUBLIC_URL=https://xxx.ngrok-free.dev)
     * we use it verbatim so the QR code is scannable from any phone.
     * Empty in dev → we fall back to the request's context path.
     */
    @org.springframework.beans.factory.annotation.Value("${app.public-url:}")
    private String appPublicUrl;

    /**
     * Print the resolved public URL once at startup so the operator sees,
     * before any RSVP, whether the QR will point to ngrok or to localhost.
     */
    @PostConstruct
    void logPublicUrl() {
        if (appPublicUrl == null || appPublicUrl.isBlank()) {
            log.warn("⚠ app.public-url is EMPTY → QR codes will use the request host " +
                     "(typically http://localhost:8080). Set APP_PUBLIC_URL or app.public-url " +
                     "in application.properties for ngrok / production.");
        } else {
            log.info("✓ app.public-url = {} (QR codes will be built on this base)", appPublicUrl);
        }
    }


    /**
     * Diagnostic — returns the public URL the QR codes will be built on.
     * Curl this from anywhere to verify the running JVM picked up the fix:
     *   curl http://localhost:8080/api/rsvp/_publicurl
     *   curl https://leptosomic-…ngrok-free.dev/api/rsvp/_publicurl
     */
    @GetMapping("/_publicurl")
    public ResponseEntity<Map<String, Object>> publicUrlInfo(HttpServletRequest request) {
        String qrBase = (appPublicUrl != null && !appPublicUrl.isBlank())
                ? appPublicUrl.replaceAll("/+$", "")
                : ServletUriComponentsBuilder.fromCurrentContextPath().toUriString();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("appPublicUrl_property", appPublicUrl);
        body.put("requestHost", request.getHeader("Host"));
        body.put("requestForwardedHost", request.getHeader("X-Forwarded-Host"));
        body.put("requestForwardedProto", request.getHeader("X-Forwarded-Proto"));
        body.put("resolvedQrBase", qrBase);
        body.put("sampleQrUrl", qrBase + "/api/rsvp/auto-scan?token=<jwt>");
        body.put("status", qrBase.contains("localhost") ? "❌ WILL POINT TO LOCALHOST" : "✓ OK");
        return ResponseEntity.ok(body);
    }


    /**
     * Diagnostic — proves whether the {@code Authorization: Bearer …} header
     * survives the gateway hop. Returns the raw header (truncated) and the
     * resolved {@link SessionUser}. Hosted under {@code /api/rsvp/_debug}
     * so we don't depend on a separate controller being picked up by the
     * component scan.
     */
    @GetMapping("/_debug")
    public ResponseEntity<Map<String, Object>> debug(HttpServletRequest request) {
        Map<String, Object> body = new HashMap<>();
        String auth = request.getHeader("Authorization");
        body.put("authorizationHeader", auth == null ? "<none>"
                : auth.length() <= 24 ? auth : auth.substring(0, 24) + "...");
        body.put("cookieHeader", request.getHeader("Cookie") == null
                ? "<none>" : request.getHeader("Cookie"));
        SessionUser me = sessionService.currentUser(request);
        body.put("authenticated", me != null);
        if (me != null) {
            body.put("user", Map.of(
                    "id", me.id(), "email", me.email(),
                    "role", me.role() == null ? "" : me.role(),
                    "fullName", me.fullName() == null ? "" : me.fullName()));
        }
        return ResponseEntity.ok(body);
    }

    /**
     * Create a confirmed RSVP for the *currently authenticated user* on an event.
     *
     * Identity comes from the {@code jwt} cookie (resolved by
     * {@link SessionService}), not from the request body — so a user can
     * never RSVP / receive a QR badge in someone else's name. The body is
     * therefore reduced to the minimum: just the {@code eventId}.
     *
     * Body: { eventId }
     *
     * Validations:
     *   - caller must be authenticated (401 otherwise)
     *   - event must exist and be published / not cancelled
     *   - capacity not exceeded (counted from confirmed RSVPs to be safe)
     *   - one confirmed RSVP per (event, user)
     *
     * Side effects:
     *   - generates a unique QR token (stored on the RSVP)
     *   - increments the event's rsvpCount
     *   - sends a confirmation email *to the connected user's address*
     *     with the QR code (best-effort, non-blocking)
     */
    @PostMapping
    @Transactional
    public ResponseEntity<?> createRsvp(@RequestBody Map<String, String> body,
                                        HttpServletRequest request) {
        SessionUser me = sessionService.currentUser(request);
        if (me == null || !me.isComplete()) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "message", "You need to be signed in to RSVP."
            ));
        }

        String eventId = body.get("eventId");
        if (eventId == null || eventId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "eventId is required"
            ));
        }

        // Identity comes from the session — body fields are ignored on purpose.
        String userId = me.id();
        String email  = me.email();
        String name   = me.fullName() == null || me.fullName().isBlank()
                ? "Member" : me.fullName();

        Event event = eventRepository.findById(eventId).orElse(null);
        if (event == null) {
            return ResponseEntity.status(404).body(Map.of(
                    "success", false,
                    "message", "Event not found"
            ));
        }

        String status = event.getStatus() == null ? "" : event.getStatus().toLowerCase();
        if ("cancelled".equals(status) || Boolean.TRUE.equals(event.getIsDeleted())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "This event is no longer available."
            ));
        }

        // Block double-RSVP from the same user
        boolean alreadyConfirmed = rsvpRepository
                .existsByEventIdAndUserIdAndStatus(eventId, userId, "confirmed");
        if (alreadyConfirmed) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "You're already registered for this event."
            ));
        }

        // Capacity check (use the live count, not the cached field, to avoid drift)
        long confirmedCount = rsvpRepository.countByEventIdAndStatus(eventId, "confirmed");
        Integer capacity = event.getCapacity();
        if (capacity != null && capacity > 0 && confirmedCount >= capacity) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Sorry, this event is full."
            ));
        }

        // Persist the RSVP first so we have its id, then attach the QR token
        RSVP rsvp = new RSVP();
        rsvp.setEventId(eventId);
        rsvp.setUserId(userId);
        rsvp.setUserEmail(email);
        rsvp.setUserName(name);
        rsvp.setStatus("confirmed");
        rsvp.setScanned(false);
        rsvp.setRsvpDate(LocalDateTime.now());

        String qrToken = qrCodeService.generateToken(eventId, userId, name, email);
        rsvp.setQrToken(qrToken);
        rsvp = rsvpRepository.save(rsvp);

        // Update the event's cached rsvp count so the UI list stays accurate
        event.setRsvpCount((int) (confirmedCount + 1));
        eventRepository.save(event);

        // The auto-scan endpoint accepts a token query-param and renders an
        // HTML check-in page directly — perfect for the QR target on the badge.
        // Prefer the configured public URL (ngrok / production gateway); fall
        // back to the request's host when the property is empty.
        String qrBase = (appPublicUrl != null && !appPublicUrl.isBlank())
                ? appPublicUrl.replaceAll("/+$", "")
                : ServletUriComponentsBuilder.fromCurrentContextPath().toUriString();
        String qrUrl = qrBase + "/api/rsvp/auto-scan?token=" + qrToken;

        // Loud log so a misconfigured tunnel is obvious from the very first RSVP.
        if (qrUrl.contains("localhost") || qrUrl.contains("127.0.0.1")) {
            log.warn("⚠ QR URL points to localhost ({}). Set app.public-url / APP_PUBLIC_URL " +
                     "to your ngrok domain so phones can scan it.", qrUrl);
        } else {
            log.info("✓ QR URL → {}", qrUrl);
        }

        // Email is best-effort: we don't fail the RSVP if SMTP is down
        try {
            emailService.sendRsvpConfirmation(email, name, event, qrUrl);
        } catch (Exception e) {
            log.warn("RSVP confirmation email failed for {} → {}", email, e.getMessage());
        }

        long newConfirmed = confirmedCount + 1;
        int  remaining    = capacity == null || capacity <= 0
                ? Integer.MAX_VALUE
                : Math.max(0, (int) (capacity - newConfirmed));
        boolean full      = capacity != null && capacity > 0 && newConfirmed >= capacity;

        RSVPResponseDTO dto = new RSVPResponseDTO();
        dto.setSuccess(true);
        dto.setMessage("RSVP confirmed — see you at " + event.getTitle() + "!");
        dto.setEventId(eventId);
        dto.setEventTitle(event.getTitle());
        dto.setUserName(name);
        dto.setUserEmail(email);
        dto.setQrToken(qrToken);
        dto.setQrUrl(qrUrl);
        dto.setRsvpDate(rsvp.getRsvpDate());
        dto.setCurrentParticipantCount((int) newConfirmed);
        dto.setRemainingSpots(remaining);
        dto.setEventFull(full);
        return ResponseEntity.ok(dto);
    }

    // Add this on the class if you want logging
    @GetMapping("/auto-scan")
    @Transactional
    public ResponseEntity<String> autoScanQr(@RequestParam String token) {

        System.out.println("Auto-scan called with token: " + token);

        Map<String, String> claims = qrCodeService.validateToken(token);
        if (claims == null) {
            return ResponseEntity.badRequest().body("<h1 style='color:red;text-align:center;padding:50px;'>❌ Invalid or Expired QR Code</h1>");
        }

        String eventId = claims.get("eventId");
        String userId = claims.get("userId");
        String name = claims.getOrDefault("name", "Member");

        RSVP rsvp = rsvpRepository
                .findFirstByEventIdAndUserIdAndStatusOrderByRsvpDateDesc(eventId, userId, "confirmed")
                .orElseGet(() -> rsvpRepository
                        .findFirstByEventIdAndUserIdOrderByRsvpDateDesc(eventId, userId)
                        .orElse(null));
        if (rsvp == null) {
            return ResponseEntity.badRequest().body("<h1 style='text-align:center;padding:50px;'>RSVP not found</h1>");
        }

        if (rsvp.isScanned()) {
            return ResponseEntity.ok("<h1 style='color:green;text-align:center;padding:40px;'>✅ Already Checked In<br>Welcome back, " + name + "!</h1>");
        }

        // Mark as scanned
        rsvp.setScanned(true);
        rsvp.setScannedAt(LocalDateTime.now());
        rsvpRepository.save(rsvp);

        // Update event attendance count
        Event event = eventRepository.findById(eventId).orElseThrow();
        int current = (event.getAttendanceCount() != null) ? event.getAttendanceCount() : 0;
        event.setAttendanceCount(current + 1);
        eventRepository.save(event);

        System.out.println("Check-in SUCCESS → Event " + eventId + " attendance now = " + event.getAttendanceCount());

        // Nice page for the phone
        String html = """
        <html>
        <head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
        <body style="font-family:Arial;text-align:center;padding:50px;background:#f0fdf4;color:#166534;">
            <h1>✅ Check-in Successful!</h1>
            <h2>Welcome, %s!</h2>
            <p>You are checked in to <strong>%s</strong></p>
            <p style="margin-top:30px;color:#555;">You can close this tab.</p>
        </body>
        </html>
        """.formatted(name, event.getTitle());

        return ResponseEntity.ok(html);
    }
    // ==================== All other endpoints unchanged ====================

    @GetMapping("/event/{eventId}/details")
    public ResponseEntity<?> getEventRSVPDetails(@PathVariable String eventId) {
        Event event = eventRepository.findById(eventId).orElse(null);
        if (event == null) {
            return ResponseEntity.notFound().build();
        }
        long confirmedCount = rsvpRepository.countByEventIdAndStatus(eventId, "confirmed");
        long attendedCount = rsvpRepository.countByEventIdAndScannedTrue(eventId);

        Map<String, Object> details = new HashMap<>();
        details.put("eventId", eventId);
        details.put("eventTitle", event.getTitle());
        details.put("eventStatus", event.getStatus());
        details.put("capacity", event.getCapacity());
        details.put("participantCount", confirmedCount);
        details.put("attendanceCount", attendedCount);
        details.put("remainingSpots", event.getCapacity() != null && event.getCapacity() > 0
                ? event.getCapacity() - confirmedCount : Integer.MAX_VALUE);
        details.put("isFull", event.getCapacity() != null && event.getCapacity() > 0 && confirmedCount >= event.getCapacity());
        details.put("startDate", event.getStartDate());
        details.put("endDate", event.getEndDate());
        details.put("location", event.getLocation());
        return ResponseEntity.ok(details);
    }

    @PostMapping("/check-batch")
    public ResponseEntity<?> checkBatchParticipation(@RequestBody Map<String, List<String>> body) {
        List<String> eventIds = body.get("eventIds");
        String userId = body.get("userId").get(0);
        Map<String, Boolean> participationStatus = new HashMap<>();
        for (String eventId : eventIds) {
            boolean exists = rsvpRepository.existsByEventIdAndUserIdAndStatus(eventId, userId, "confirmed");
            participationStatus.put(eventId, exists);
        }
        return ResponseEntity.ok(participationStatus);
    }

    @PostMapping("/scan")
    public ResponseEntity<?> scanQr(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        Map<String, String> claims = qrCodeService.validateToken(token);
        if (claims == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Invalid QR code"));
        }

        String eventId = claims.get("eventId");
        String userId = claims.get("userId");

        RSVP rsvp = rsvpRepository
                .findFirstByEventIdAndUserIdAndStatusOrderByRsvpDateDesc(eventId, userId, "confirmed")
                .orElseGet(() -> rsvpRepository
                        .findFirstByEventIdAndUserIdOrderByRsvpDateDesc(eventId, userId)
                        .orElse(null));
        if (rsvp == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "RSVP not found"));
        }

        if (rsvp.isScanned()) {
            return ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "Already checked in",
                    "memberName", claims.get("name"),
                    "alreadyScanned", true
            ));
        }

        rsvp.setScanned(true);
        rsvp.setScannedAt(LocalDateTime.now());
        rsvpRepository.save(rsvp);

        Event event = eventRepository.findById(eventId).orElseThrow();
        event.setAttendanceCount(event.getAttendanceCount() + 1);
        eventRepository.save(event);

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Welcome " + claims.get("name") + "!",
                "memberName", claims.get("name"),
                "scannedAt", LocalDateTime.now().toString()
        ));
    }

    @GetMapping("/event/{eventId}/rsvp-count")
    public ResponseEntity<Long> getRsvpCount(@PathVariable String eventId) {
        return ResponseEntity.ok(rsvpRepository.countByEventIdAndStatus(eventId, "confirmed"));
    }

    @GetMapping("/event/{eventId}/attendance-count")
    public ResponseEntity<Long> getAttendanceCount(@PathVariable String eventId) {
        return ResponseEntity.ok(rsvpRepository.countByEventIdAndScannedTrue(eventId));
    }

    @GetMapping("/event/{eventId}")
    public ResponseEntity<List<RSVP>> getEventRsvps(@PathVariable String eventId) {
        return ResponseEntity.ok(rsvpRepository.findByEventId(eventId));
    }

    @DeleteMapping("/{eventId}/{userId}")
    @Transactional
    public ResponseEntity<?> cancelRsvp(@PathVariable String eventId, @PathVariable String userId) {
        try {
            // Cancel every confirmed RSVP for this (event, user) pair — handles legacy duplicates
            List<RSVP> confirmed = rsvpRepository.findByEventIdAndStatus(eventId, "confirmed")
                    .stream()
                    .filter(r -> userId.equals(r.getUserId()))
                    .toList();

            if (confirmed.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "RSVP not found"
                ));
            }

            boolean anyScanned = confirmed.stream().anyMatch(RSVP::isScanned);
            if (anyScanned) {
                return ResponseEntity.badRequest().body(Map.of(
                        "success", false,
                        "message", "Cannot cancel already scanned RSVP"
                ));
            }

            int cancelled = 0;
            for (RSVP rsvp : confirmed) {
                rsvp.setStatus("cancelled");
                rsvpRepository.save(rsvp);
                cancelled++;
            }

            Event event = eventRepository.findById(eventId).orElse(null);
            if (event != null) {
                int current = event.getRsvpCount() != null ? event.getRsvpCount() : 0;
                event.setRsvpCount(Math.max(0, current - cancelled));
                eventRepository.save(event);
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "RSVP cancelled successfully",
                    "cancelledCount", cancelled
            ));
        } catch (Exception e) {
            log.error("Error cancelling RSVP for event {} user {}: {}", eventId, userId, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "message", "Error cancelling RSVP: " + e.getMessage()
            ));
        }
    }

    private RSVP resolveRsvp(String eventId, String userId) {
        return rsvpRepository.findFirstByEventIdAndUserIdOrderByRsvpDateDesc(eventId, userId)
                .orElse(null);
    }
}