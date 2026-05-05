package tn.esprit.virtual_event_management.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.esprit.virtual_event_management.entity.EventRecord;
import tn.esprit.virtual_event_management.service.IEventRecordService;

import java.util.List;

@RestController
@RequestMapping("/api/records")
@RequiredArgsConstructor
public class EventRecordController {
    private final IEventRecordService eventRecordService;

    @PostMapping
    public ResponseEntity<EventRecord> createRecord(@RequestBody EventRecord record) {
        return ResponseEntity.status(HttpStatus.CREATED).body(eventRecordService.createRecord(record));
    }

    @PutMapping("/{id}")
    public ResponseEntity<EventRecord> updateRecord(@PathVariable String id,
                                                    @RequestBody EventRecord record) {
        return ResponseEntity.ok(eventRecordService.updateRecord(id, record));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRecord(@PathVariable String id) {
        eventRecordService.deleteRecord(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<EventRecord> getRecordById(@PathVariable String id) {
        return eventRecordService.getRecordById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<EventRecord>> getAllRecords() {
        return ResponseEntity.ok(eventRecordService.getAllRecords());
    }

    @GetMapping("/gdpr/{consent}")
    public ResponseEntity<List<EventRecord>> getRecordsByGdprConsent(@PathVariable Boolean consent) {
        return ResponseEntity.ok(eventRecordService.getRecordsByGdprConsent(consent));
    }

    @GetMapping("/event/{virtualEventId}")
    public ResponseEntity<List<EventRecord>> getRecordsByVirtualEvent(@PathVariable int virtualEventId) {
        return ResponseEntity.ok(eventRecordService.getRecordsByVirtualEvent(virtualEventId));
    }
}
