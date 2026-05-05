package tn.esprit.clubhub.Repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import tn.esprit.clubhub.Entity.Task;

import java.util.List;

@Repository
public interface TaskRepository extends MongoRepository<Task, String> {
    List<Task> findByAssignedToAndStatus(String userId, String status);
    List<Task> findByEventIdAndAssignedTo(String eventId, String userId);
    List<Task> findByEventId(String eventId);
    List<Task> findByAssignedTo(String userId);

    long countByEventIdAndStatus(String eventId, String status);
}