package tn.esprit.clubhub.Controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import tn.esprit.clubhub.Entity.BorrowedItem;
import tn.esprit.clubhub.Entity.Devis;
import tn.esprit.clubhub.Entity.RSVP;
import tn.esprit.clubhub.Entity.Task;
import tn.esprit.clubhub.Repository.BorrowedItemRepository;
import tn.esprit.clubhub.Repository.DevisRepository;
import tn.esprit.clubhub.Repository.EventRepository;
import tn.esprit.clubhub.Entity.Event;
import tn.esprit.clubhub.Repository.RSVPRepository;
import tn.esprit.clubhub.Repository.TaskRepository;
import tn.esprit.clubhub.Security.SessionService;
import tn.esprit.clubhub.Security.SessionUser;
import jakarta.servlet.http.HttpServletRequest;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/events")
public class EventController {

    @Autowired
    private EventRepository eventRepository;
    @Autowired
    private RSVPRepository rsvpRepository;
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private BorrowedItemRepository borrowedItemRepository;
    @Autowired
    private DevisRepository devisRepository;
    @Autowired
    private SessionService sessionService;
    @GetMapping
    public ResponseEntity<?> getAllEvents() {
        try {
            List<Event> events = eventRepository.findAll();

            // Convert to safe response DTO
            List<Map<String, Object>> safeEvents = convertToSafeResponse(events);

            return ResponseEntity.ok(safeEvents);
        } catch (Exception e) {
            log.error("Error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to load events: " + e.getMessage()));
        }
    }

    @GetMapping("/with-counts")
    public ResponseEntity<?> getAllEventsWithParticipantCounts() {
        try {
            List<Event> events = eventRepository.findAll();
             
            // Convert to consistent format for frontend
            List<Map<String, Object>> response = new ArrayList<>();

            for (Event event : events) {
                Map<String, Object> safeEvent = new HashMap<>();
                safeEvent.put("id", event.getId());
                safeEvent.put("title", event.getTitle());
                safeEvent.put("description", event.getDescription() != null ? event.getDescription() : "");
                safeEvent.put("status", event.getStatus() != null ? event.getStatus() : "draft");
                safeEvent.put("capacity", event.getCapacity() != null ? event.getCapacity() : 0);
                safeEvent.put("rsvpCount", event.getRsvpCount());
                safeEvent.put("attendanceCount", event.getAttendanceCount());
                safeEvent.put("participantCount", event.getRsvpCount());

                // Format dates consistently
                if (event.getStartDate() != null) {
                    safeEvent.put("startDate", event.getStartDate().toString());
                } else {
                    safeEvent.put("startDate", null);
                }

                if (event.getEndDate() != null) {
                    safeEvent.put("endDate", event.getEndDate().toString());
                } else {
                    safeEvent.put("endDate", null);
                }

                if (event.getCreatedAt() != null) {
                    safeEvent.put("createdAt", event.getCreatedAt().toString());
                }

                if (event.getUpdatedAt() != null) {
                    safeEvent.put("updatedAt", event.getUpdatedAt().toString());
                }

                // Handle location
                if (event.getLocation() != null) {
                    Map<String, Object> location = new HashMap<>();
                    location.put("name", event.getLocation().getName() != null ? event.getLocation().getName() : "");
                    location.put("address", event.getLocation().getAddress() != null ? event.getLocation().getAddress() : "");
                    if (event.getLocation().getCoordinates() != null) {
                        location.put("coordinates", event.getLocation().getCoordinates());
                    }
                    safeEvent.put("location", location);
                } else {
                    safeEvent.put("location", null);
                }

                safeEvent.put("staff", event.getStaff() != null ? event.getStaff() : new ArrayList<>());
                safeEvent.put("calendar", event.getCalendar() != null ? event.getCalendar() : "draft");
                safeEvent.put("eventFormat", event.getEventFormat());
                safeEvent.put("eventFormatCustom", event.getEventFormatCustom());
                safeEvent.put("createdBy", event.getCreatedBy() != null ? event.getCreatedBy() : "unknown");

                response.add(safeEvent);
            }

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ArrayList<>());
        }
    }

    @GetMapping("/upcoming")
    public ResponseEntity<?> getUpcomingEvents() {
        try {
            LocalDateTime now = LocalDateTime.now();
            List<Event> allEvents = eventRepository.findAll();

            List<Event> upcoming = allEvents.stream()
                    .filter(e -> e.getStartDate() != null)
                    .filter(e -> e.getStartDate().isAfter(now))
                    .filter(e -> "published".equalsIgnoreCase(e.getStatus()))
                    .collect(Collectors.toList());

            List<Map<String, Object>> safeEvents = convertToSafeResponse(upcoming);

            return ResponseEntity.ok(safeEvents);
        } catch (Exception e) {
            log.error("Error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ArrayList<>());
        }
    }

    @GetMapping("/past")
    public ResponseEntity<?> getPastEvents() {
        try {
            LocalDateTime now = LocalDateTime.now();
            List<Event> allEvents = eventRepository.findAll();

            List<Event> past = allEvents.stream()
                    .filter(e -> e.getStartDate() != null)
                    .filter(e -> e.getStartDate().isBefore(now))
                    .collect(Collectors.toList());

            List<Map<String, Object>> safeEvents = convertToSafeResponse(past);

            return ResponseEntity.ok(safeEvents);
        } catch (Exception e) {
            log.error("Error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ArrayList<>());
        }
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<?> getEventsByStatus(@PathVariable String status) {
        try {
            List<Event> events = eventRepository.findByStatus(status);
            List<Map<String, Object>> safeEvents = convertToSafeResponse(events);
            return ResponseEntity.ok(safeEvents);
        } catch (Exception e) {
            log.error("Error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ArrayList<>());
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> searchEvents(@RequestParam String title) {
        try {
            List<Event> events = eventRepository.findByTitleContainingIgnoreCase(title);
            List<Map<String, Object>> safeEvents = convertToSafeResponse(events);
            return ResponseEntity.ok(safeEvents);
        } catch (Exception e) {
            log.error("Error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ArrayList<>());
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<?> getEventStats() {
        try {
            List<Event> allEvents = eventRepository.findAll();
            LocalDateTime now = LocalDateTime.now();

            Map<String, Long> stats = new HashMap<>();
            stats.put("totalEvents", (long) allEvents.size());
            stats.put("publishedEvents", allEvents.stream().filter(e -> "published".equals(e.getStatus())).count());
            stats.put("cancelledEvents", allEvents.stream().filter(e -> "cancelled".equals(e.getStatus())).count());
            stats.put("completedEvents", allEvents.stream().filter(e -> "completed".equals(e.getStatus())).count());
            stats.put("upcomingEvents", allEvents.stream()
                    .filter(e -> e.getStartDate() != null && e.getStartDate().isAfter(now))
                    .count());

            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            log.error("Error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to load stats: " + e.getMessage()));
        }
    }

    @PostMapping
    public ResponseEntity<?> createEvent(@RequestBody Event event,
                                         HttpServletRequest request) {
        try {
            if (event.getTitle() == null || event.getTitle().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Event title is required"));
            }

            // Author identity is taken from the JWT, NOT from the request
            // body — that prevents the frontend from sending placeholder
            // values like "current-user-id" (which used to land in the DB).
            SessionUser me = sessionService.currentUser(request);
            if (me != null && me.id() != null) {
                event.setCreatedBy(me.id());
            } else if (event.getCreatedBy() == null
                    || event.getCreatedBy().isBlank()
                    || "current-user-id".equals(event.getCreatedBy())) {
                // No session AND no usable value in the body → reject so we
                // never persist the literal placeholder again.
                return ResponseEntity.status(401).body(Map.of(
                        "error", "You must be signed in to create an event."));
            }

            LocalDateTime now = LocalDateTime.now();
            event.setCreatedAt(now);
            event.setUpdatedAt(now);
            event.setRsvpCount(0);
            event.setAttendanceCount(0);

            if (event.getStatus() == null) event.setStatus("draft");
            if (event.getCapacity() == null) event.setCapacity(0);

            Event saved = eventRepository.save(event);

            // Convert to safe response
            Map<String, Object> safeEvent = convertSingleEventToSafeResponse(saved);

            return ResponseEntity.status(HttpStatus.CREATED).body(safeEvent);

        } catch (Exception e) {
            log.error("Error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to create event: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateEvent(@PathVariable String id, @RequestBody Event event) {
        try {
            Optional<Event> existingOpt = eventRepository.findById(id);
            if (existingOpt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Event existing = existingOpt.get();

            if (event.getTitle() != null && event.getTitle().trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Event title cannot be empty"));
            }

            if (event.getTitle() != null) existing.setTitle(event.getTitle());
            if (event.getDescription() != null) existing.setDescription(event.getDescription());
            if (event.getStartDate() != null) existing.setStartDate(event.getStartDate());
            if (event.getEndDate() != null) existing.setEndDate(event.getEndDate());
            if (event.getLocation() != null) existing.setLocation(event.getLocation());
            if (event.getCapacity() != null) existing.setCapacity(event.getCapacity());
            if (event.getStatus() != null) existing.setStatus(event.getStatus());
            if (event.getStaff() != null) existing.setStaff(event.getStaff());
            existing.setEventFormat(event.getEventFormat());
            existing.setEventFormatCustom(event.getEventFormatCustom());
            // Remove imageUrl if not in entity
            // if (event.getImageUrl() != null) existing.setImageUrl(event.getImageUrl());

            existing.setUpdatedAt(LocalDateTime.now());

            Event updated = eventRepository.save(existing);

            // Convert to safe response
            Map<String, Object> safeEvent = convertSingleEventToSafeResponse(updated);

            return ResponseEntity.ok(safeEvent);

        } catch (Exception e) {
            log.error("Error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to update event: " + e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteEvent(@PathVariable String id) {
        try {
            Optional<Event> optional = eventRepository.findById(id);
            if (optional.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            // Cascade: remove associated tasks so they don't become orphans
            List<Task> linkedTasks = taskRepository.findByEventId(id);
            int tasksDeleted = linkedTasks.size();
            if (!linkedTasks.isEmpty()) {
                taskRepository.deleteAll(linkedTasks);
            }

            // Cascade: remove associated RSVPs (emailed invites + scans)
            List<RSVP> linkedRsvps = rsvpRepository.findByEventId(id);
            int rsvpsDeleted = linkedRsvps.size();
            if (!linkedRsvps.isEmpty()) {
                rsvpRepository.deleteAll(linkedRsvps);
            }

            // Cascade: remove every "need" attached to this event (BorrowedItem)
            // and the supplier quotes (Devis) submitted for those needs. The
            // treasurer is NOT allowed to create needs, but if an event the
            // event manager built ever disappears we don't want orphan rows
            // showing up in the Trésorier dashboard.
            List<BorrowedItem> linkedItems = borrowedItemRepository.findByEventId(id);
            int needsDeleted = linkedItems.size();
            int devisDeleted = 0;
            if (!linkedItems.isEmpty()) {
                for (BorrowedItem it : linkedItems) {
                    List<Devis> linkedDevis = devisRepository.findByBorrowedItemId(it.getId());
                    if (!linkedDevis.isEmpty()) {
                        devisDeleted += linkedDevis.size();
                        devisRepository.deleteAll(linkedDevis);
                    }
                }
                borrowedItemRepository.deleteAll(linkedItems);
            }

            eventRepository.deleteById(id);

            return ResponseEntity.ok(Map.of(
                    "message", "Event deleted successfully",
                    "tasksDeleted", tasksDeleted,
                    "rsvpsDeleted", rsvpsDeleted,
                    "needsDeleted", needsDeleted,
                    "devisDeleted", devisDeleted
            ));

        } catch (Exception e) {
            log.error("Error: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to delete event: " + e.getMessage()));
        }
    }

    // Helper method to convert Event to safe Map (no null values)
    private List<Map<String, Object>> convertToSafeResponse(List<Event> events) {
        List<Map<String, Object>> safeEvents = new ArrayList<>();

        for (Event event : events) {
            safeEvents.add(convertSingleEventToSafeResponse(event));
        }

        return safeEvents;
    }

    // Helper method to convert single Event to safe Map
    private Map<String, Object> convertSingleEventToSafeResponse(Event event) {
        Map<String, Object> safeEvent = new HashMap<>();

        // Basic fields
        safeEvent.put("id", event.getId());
        safeEvent.put("title", event.getTitle() != null ? event.getTitle() : "Untitled");
        safeEvent.put("description", event.getDescription() != null ? event.getDescription() : "");
        safeEvent.put("status", event.getStatus() != null ? event.getStatus() : "draft");
        safeEvent.put("calendar", event.getCalendar() != null ? event.getCalendar() : "draft");
        safeEvent.put("capacity", event.getCapacity() != null ? event.getCapacity() : 0);
        safeEvent.put("rsvpCount", event.getRsvpCount() != null ? event.getRsvpCount() : 0);
        safeEvent.put("attendanceCount", event.getAttendanceCount() != null ? event.getAttendanceCount() : 0);
        safeEvent.put("participantCount", event.getRsvpCount() != null ? event.getRsvpCount() : 0);

        // Handle dates - convert to ISO string or null
        if (event.getStartDate() != null) {
            safeEvent.put("startDate", event.getStartDate().toString());
        } else {
            safeEvent.put("startDate", null);
        }

        if (event.getEndDate() != null) {
            safeEvent.put("endDate", event.getEndDate().toString());
        } else {
            safeEvent.put("endDate", null);
        }

        if (event.getCreatedAt() != null) {
            safeEvent.put("createdAt", event.getCreatedAt().toString());
        } else {
            safeEvent.put("createdAt", null);
        }

        if (event.getUpdatedAt() != null) {
            safeEvent.put("updatedAt", event.getUpdatedAt().toString());
        } else {
            safeEvent.put("updatedAt", null);
        }

        // Handle location
        if (event.getLocation() != null) {
            Map<String, Object> location = new HashMap<>();
            location.put("name", event.getLocation().getName() != null ? event.getLocation().getName() : "");
            location.put("address", event.getLocation().getAddress() != null ? event.getLocation().getAddress() : "");

            if (event.getLocation().getCoordinates() != null) {
                Map<String, Double> coords = new HashMap<>();
                coords.put("lat", event.getLocation().getCoordinates().getOrDefault("lat", 33.8869));
                coords.put("lng", event.getLocation().getCoordinates().getOrDefault("lng", 9.5375));
                location.put("coordinates", coords);
            }
            safeEvent.put("location", location);
        } else {
            safeEvent.put("location", null);
        }

        // Handle staff
        safeEvent.put("staff", event.getStaff() != null ? event.getStaff() : new ArrayList<>());

        // Handle createdBy
        safeEvent.put("createdBy", event.getCreatedBy() != null ? event.getCreatedBy() : "unknown");

        safeEvent.put("eventFormat", event.getEventFormat());
        safeEvent.put("eventFormatCustom", event.getEventFormatCustom());

        // Handle categoryId

        return safeEvent;
    }
    @GetMapping("/filtered")
    public ResponseEntity<?> getFilteredEvents(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean hasUnchecked,
            @RequestParam(required = false) Boolean hasCapacity,
            @RequestParam(required = false) String eventFormat) {
        try {
            List<Event> events = eventRepository.findAll();

            // Apply filters
            if (status != null && !status.isEmpty()) {
                events = events.stream()
                        .filter(e -> status.equalsIgnoreCase(e.getStatus()))
                        .collect(Collectors.toList());
            }

            if (dateFrom != null && !dateFrom.isEmpty()) {
                LocalDateTime fromDate = LocalDateTime.parse(dateFrom + "T00:00:00");
                events = events.stream()
                        .filter(e -> e.getStartDate() != null && e.getStartDate().isAfter(fromDate))
                        .collect(Collectors.toList());
            }

            if (dateTo != null && !dateTo.isEmpty()) {
                LocalDateTime toDate = LocalDateTime.parse(dateTo + "T23:59:59");
                events = events.stream()
                        .filter(e -> e.getStartDate() != null && e.getStartDate().isBefore(toDate))
                        .collect(Collectors.toList());
            }

            if (search != null && !search.isEmpty()) {
                events = events.stream()
                        .filter(e -> e.getTitle().toLowerCase().contains(search.toLowerCase()))
                        .collect(Collectors.toList());
            }

            if (hasUnchecked != null && hasUnchecked) {
                // Filter events that have participants who haven't checked in
                events = events.stream()
                        .filter(e -> {
                            long pendingCount = rsvpRepository.countByEventIdAndScanned(e.getId(), false);
                            return pendingCount > 0;
                        })
                        .collect(Collectors.toList());
            }

            if (hasCapacity != null && hasCapacity) {
                events = events.stream()
                        .filter(e -> e.getCapacity() == null || e.getCapacity() == 0 ||
                                e.getRsvpCount() < e.getCapacity())
                        .collect(Collectors.toList());
            }

            if (eventFormat != null && !eventFormat.isEmpty()) {
                events = events.stream()
                        .filter(e -> eventFormat.equalsIgnoreCase(e.getEventFormat()))
                        .collect(Collectors.toList());
            }

            return ResponseEntity.ok(events);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ArrayList<>());
        }
    }

    /**
     * Single event by id (same safe payload as list endpoints, including staff).
     * Required by borrowed-items when selecting an event — without this, GET /api/events/{id} returned 404.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getEventById(@PathVariable String id) {
        try {
            Optional<Event> opt = eventRepository.findById(id);
            if (opt.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(convertSingleEventToSafeResponse(opt.get()));
        } catch (Exception e) {
            log.error("getEventById {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to load event: " + e.getMessage()));
        }
    }

    @GetMapping("/{eventId}/attendance")
    public ResponseEntity<Map<String, Object>> getEventAttendance(@PathVariable String eventId) {
        Event event = eventRepository.findById(eventId).orElse(null);
        if (event == null) {
            return ResponseEntity.notFound().build();
        }

        // Only consider confirmed RSVPs (people who got the email). Ignore cancelled ones.
        List<RSVP> confirmed = rsvpRepository.findByEventIdAndStatus(eventId, "confirmed");

        String eventStatus = event.getStatus() != null ? event.getStatus().toLowerCase() : "";
        boolean isTerminated = "completed".equals(eventStatus) || "cancelled".equals(eventStatus);

        List<Map<String, Object>> attendees = confirmed.stream().map(rsvp -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", rsvp.getId());
            map.put("userId", rsvp.getUserId());
            map.put("name", rsvp.getUserName());
            map.put("email", rsvp.getUserEmail());
            map.put("scanned", rsvp.isScanned());
            map.put("scannedAt", rsvp.getScannedAt() != null ? rsvp.getScannedAt().toString() : null);
            map.put("rsvpDate", rsvp.getRsvpDate() != null ? rsvp.getRsvpDate().toString() : null);

            // Derived status:
            //  - checked-in: RSVP scanned the QR at the door
            //  - no-show:    event is terminated and the person never scanned
            //  - pending:    RSVP confirmed (email sent), event not yet terminated, not scanned
            String derivedStatus;
            if (rsvp.isScanned()) {
                derivedStatus = "checked-in";
            } else if (isTerminated) {
                derivedStatus = "no-show";
            } else {
                derivedStatus = "pending";
            }
            map.put("attendanceStatus", derivedStatus);
            return map;
        }).collect(Collectors.toList());

        long checkedIn = attendees.stream().filter(a -> "checked-in".equals(a.get("attendanceStatus"))).count();
        long pending   = attendees.stream().filter(a -> "pending".equals(a.get("attendanceStatus"))).count();
        long noShow    = attendees.stream().filter(a -> "no-show".equals(a.get("attendanceStatus"))).count();

        Map<String, Object> response = new HashMap<>();
        response.put("eventId", event.getId());
        response.put("title", event.getTitle());
        response.put("status", event.getStatus());
        response.put("rsvpCount", event.getRsvpCount() != null ? event.getRsvpCount() : confirmed.size());
        response.put("attendanceCount", event.getAttendanceCount() != null ? event.getAttendanceCount() : checkedIn);
        response.put("checkedInCount", checkedIn);
        response.put("pendingCount", pending);
        response.put("noShowCount", noShow);
        response.put("eventTerminated", isTerminated);
        response.put("attendees", attendees);

        return ResponseEntity.ok(response);
    }
}