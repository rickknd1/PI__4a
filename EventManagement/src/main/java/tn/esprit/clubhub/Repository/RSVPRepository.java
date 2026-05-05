package tn.esprit.clubhub.Repository;

import tn.esprit.clubhub.Entity.RSVP;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RSVPRepository extends MongoRepository<RSVP, String> {

    // Count confirmed RSVPs for an event (people who signed up)
    long countByEventIdAndStatus(String eventId, String status);

    // Count checked-in attendees (people who actually scanned)
    // Spring Data MongoDB will automatically implement this method
    long countByEventIdAndScannedTrue(String eventId);

    // Alternative: Using @Query annotation if the above doesn't work
    @Query("{ 'eventId': ?0, 'scanned': true }")
    long countCheckedInAttendees(String eventId);




    // Check if user already RSVPed (any status)
    boolean existsByEventIdAndUserId(String eventId, String userId);

    // Check if user has an active (confirmed) RSVP
    boolean existsByEventIdAndUserIdAndStatus(String eventId, String userId, String status);

    // NOTE: historical duplicates exist in the DB (same eventId + userId more than
    // once), so we avoid `Optional<RSVP> findByEventIdAndUserId(...)` which throws
    // IncorrectResultSizeDataAccessException in that case. Use one of:
    //   - findFirstByEventIdAndUserIdOrderByRsvpDateDesc(...)
    //   - findFirstByEventIdAndUserIdAndStatusOrderByRsvpDateDesc(..., "confirmed")
    //   - findByEventIdAndUserIdOrderByRsvpDateDesc(...)  // returns List
    List<RSVP> findByEventIdAndUserIdOrderByRsvpDateDesc(String eventId, String userId);

    // Get all RSVPs for an event
    List<RSVP> findByEventId(String eventId);

    // Get RSVPs by status
    List<RSVP> findByStatus(String status);

    // Get RSVPs by event and status
    List<RSVP> findByEventIdAndStatus(String eventId, String status);

    // Get checked-in RSVPs for an event (people who scanned)
    List<RSVP> findByEventIdAndScannedTrue(String eventId);

    // Get RSVPs that are not scanned yet
    List<RSVP> findByEventIdAndScannedFalse(String eventId);

    // Count RSVPs by event and scanned status
    long countByEventIdAndScanned(String eventId, boolean scanned);
    Optional<RSVP> findFirstByEventIdAndUserIdAndStatusOrderByRsvpDateDesc(String eventId, String userId, String status);
    // Get RSVPs by user
    List<RSVP> findByUserId(String userId);

    // Get user's upcoming events (not scanned yet)
    List<RSVP> findByUserIdAndScannedFalseAndStatus(String userId, String status);
    Optional<RSVP> findFirstByEventIdAndUserIdOrderByRsvpDateDesc(String eventId, String userId);

}