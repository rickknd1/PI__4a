package tn.esprit.virtual_event_management.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tn.esprit.virtual_event_management.entity.EventRegistration;
import tn.esprit.virtual_event_management.entity.VirtualEvent;

import java.time.LocalDateTime;
import java.util.List;

public interface VirtualEventRepository extends MongoRepository<VirtualEvent, String> {
    List<VirtualEvent> findByOrganizerId(String organizerId);
    List<VirtualEvent> findByScheduledAtBetween(LocalDateTime start, LocalDateTime end);
    List<VirtualEvent> findByIsRecording(Boolean isRecording);
}
