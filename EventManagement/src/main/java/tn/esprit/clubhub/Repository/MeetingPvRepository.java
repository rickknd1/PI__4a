package tn.esprit.clubhub.Repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tn.esprit.clubhub.Entity.MeetingPv;

import java.util.List;

public interface MeetingPvRepository extends MongoRepository<MeetingPv, String> {
    List<MeetingPv> findAllByOrderByCreatedAtDesc();
    List<MeetingPv> findByEventId(String eventId);
    boolean existsByEventId(String eventId);
}
