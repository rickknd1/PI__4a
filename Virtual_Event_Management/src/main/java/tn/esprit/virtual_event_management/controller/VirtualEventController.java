package tn.esprit.virtual_event_management.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.*;
import tn.esprit.virtual_event_management.entity.EventRegistration;
import tn.esprit.virtual_event_management.entity.User;
import tn.esprit.virtual_event_management.entity.VirtualEvent;
import tn.esprit.virtual_event_management.service.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/virtual-events")
public class VirtualEventController {
    private final IVirtualEventService virtualEventService;
    private final PdfService pdfService;
    private final EventRegistrationService registrationService;
    private final IEventRegistrationService service;

    public VirtualEventController(
            IVirtualEventService virtualEventService,
            EventRegistrationService registrationService,
            IEventRegistrationService service,
            PdfService pdfService
    ) {
        this.virtualEventService = virtualEventService;
        this.registrationService = registrationService;
        this.service = service;
        this.pdfService = pdfService;
    }

    @PostMapping
    public ResponseEntity<VirtualEvent> createEvent(@RequestBody VirtualEvent event) {
        event.setMeetingLink(null);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(virtualEventService.createEvent(event));
    }

    @PutMapping("/{id}")
    public ResponseEntity<VirtualEvent> updateEvent(@PathVariable String id,
                                                    @RequestBody VirtualEvent event) {
        return ResponseEntity.ok(virtualEventService.updateEvent(id, event));
    }

    @PutMapping("/{id}/join")
    public ResponseEntity<VirtualEvent> joinEvent(@PathVariable String id) {
        return ResponseEntity.ok(virtualEventService.joinEvent(id));
    }

    @GetMapping("/{id}/link")
    public ResponseEntity<String> getMeetingLink(@PathVariable String id) {
        return virtualEventService.getEventById(id)
                .map(e -> ResponseEntity.ok(e.getMeetingLink()))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}")
    public ResponseEntity<VirtualEvent> getEventById(@PathVariable String id) {
        return virtualEventService.getEventById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<VirtualEvent>> getAllEvents() {
        return ResponseEntity.ok(virtualEventService.getAllEvents());
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> getPdf(@PathVariable String id) {
        VirtualEvent event = virtualEventService.getEventById(id)
                .orElseThrow(() -> new RuntimeException("Event introuvable"));

        byte[] pdf = pdfService.generateEventPdf(event);

        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=event.pdf")
                .header("Content-Type", "application/pdf")
                .body(pdf);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable String id) {
        virtualEventService.deleteEvent(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{eventId}/register/{userId}")
    public ResponseEntity<EventRegistration> register(
            @PathVariable String eventId,
            @PathVariable String userId) {

        EventRegistration reg = service.register(eventId, userId);
        return ResponseEntity.ok(reg);
    }

    @GetMapping("/{eventId}/can-join/{userId}")
    public ResponseEntity<Boolean> canJoin(@PathVariable String eventId,
                                           @PathVariable String userId) {
        return ResponseEntity.ok(registrationService.canJoin(eventId, userId));
    }

    @PostMapping("/{eventId}/pay/{userId}")
    public ResponseEntity<EventRegistration> payEvent(
            @PathVariable String eventId,
            @PathVariable String userId) {

        EventRegistration registration = service.markAsPaid(eventId, userId);
        return ResponseEntity.ok(registration);
    }




}
