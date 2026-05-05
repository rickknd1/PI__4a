package tn.esprit.clubhub.Repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import tn.esprit.clubhub.Entity.Event;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EventRepository extends MongoRepository<Event, String> {

    List<Event> findByStatus(String status);

    List<Event> findByTitleContainingIgnoreCase(String title);

    List<Event> findByStartDateBetween(LocalDateTime start, LocalDateTime end);

    @Query("{ 'status': 'published', 'startDate': { $gt: ?0 } }")
    List<Event> findUpcomingEvents(LocalDateTime now);

    @Query("{ $or: [ "
         + "{ 'endDate': { $lt: ?0 } }, "
         + "{ 'endDate': null, 'status': { $in: ['completed', 'cancelled'] }, 'startDate': { $lt: ?0 } } "
         + "] }")
    List<Event> findPastEvents(LocalDateTime now);

    @Query("{ 'status': 'published', 'capacity': { $exists: true, $gt: 0 }, 'rsvpCount': { $lt: '$capacity' } }")
    List<Event> findEventsWithAvailableSpots();

    long countByStatus(String status);

    // ── NEW: Get events with participant counts for RSVP component ─────────

    /**
     * Find all published events sorted by start date (upcoming first)
     */
    @Query("{ 'status': 'published' }")
    List<Event> findAllPublishedEvents();

    /**
     * Find events by their IDs (for batch checking)
     */
    List<Event> findByIdIn(List<String> ids);

    /**
     * Find events that are not completed (status not 'completed' or 'cancelled')
     */
    @Query("{ 'status': { $nin: ['completed', 'cancelled'] }, 'startDate': { $gt: ?0 } }")
    List<Event> findActiveEvents(LocalDateTime now);

    /**
     * Count events by status with case-insensitive matching
     */
    @Query(value = "{ 'status': ?0 }", count = true)
    long countByStatusIgnoreCase(String status);

    /**
     * Find events with capacity remaining (not full)
     */
    @Query("{ 'status': 'published', $expr: { $lt: [ { $ifNull: ['$rsvpCount', 0] }, '$capacity' ] } }")
    List<Event> findEventsWithRemainingCapacity();

    /**
     * Get upcoming events with limit (for dashboard)
     */
    @Query(value = "{ 'status': 'published', 'startDate': { $gt: ?0 } }", sort = "{ 'startDate': 1 }")
    List<Event> findTopUpcomingEvents(LocalDateTime now, org.springframework.data.domain.Pageable pageable);
}