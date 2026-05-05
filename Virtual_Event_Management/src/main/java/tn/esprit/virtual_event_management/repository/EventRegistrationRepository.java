package tn.esprit.virtual_event_management.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tn.esprit.virtual_event_management.entity.EventRegistration;

import java.util.Optional;

public interface EventRegistrationRepository extends MongoRepository<EventRegistration, String> {
    Optional<EventRegistration> findByEventIdAndUserId(String eventId, String userId);
}
