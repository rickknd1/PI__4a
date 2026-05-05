package tn.esprit.clubhub.Repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import tn.esprit.clubhub.Entity.EventFeedback;

import java.util.List;
import java.util.Optional;

@Repository
public interface EventFeedbackRepository extends MongoRepository<EventFeedback, String> {

    List<EventFeedback> findByEventId(String eventId);

    List<EventFeedback> findByClubId(String clubId);

    Optional<EventFeedback> findFirstByEventIdAndUserIdOrderByCreatedAtDesc(String eventId, String userId);

    long countByEventId(String eventId);
}
