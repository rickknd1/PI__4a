package tn.esprit.virtual_event_management.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tn.esprit.virtual_event_management.entity.EventReview;

import java.util.List;
import java.util.Optional;
public interface EventReviewRepository extends MongoRepository<EventReview, String> {

    List<EventReview> findByEventIdAndApprovedTrueOrderByCreatedAtDesc(String eventId);

    Optional<EventReview> findByEventIdAndUserId(String eventId, String userId);
}
