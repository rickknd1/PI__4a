package tn.esprit.clubhub.Entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Multi-dimensional feedback left by an attendee on an event.
 *
 * Why not a single 1–5 rating?
 *   A flat star score is too coarse to feed a recommender — we lose the
 *   reason "why". Five lightweight dimensions + structured tags give us
 *   per-aspect signal while staying fast to fill out (~15 seconds).
 *
 * Score conventions:
 *   - dimension scores are 1..5 (Number, optional — null = "no opinion")
 *   - npsLikelihood is 0..10 ("would you come again?") to mirror NPS
 *   - tags are short keywords from a controlled vocabulary on the frontend
 *     (e.g. "well-organized", "engaging-speaker", "venue-too-small")
 *
 * Computed signals (derived elsewhere, not stored):
 *   - composite = average of non-null dimension scores
 *   - sentiment = sign(composite − 3) weighted by NPS
 *   - format/staff "lift" used by EventRecommendationController
 */
@Document(collection = "event_feedbacks")
public class EventFeedback {

    @Id
    private String id;

    private String eventId;
    /** Snapshot at submission time so the feedback survives later edits to the event. */
    private String eventTitle;
    private String eventFormat;
    private String clubId;

    private String userId;
    private String userName;

    // ── Dimensions (1..5, null = skipped) ────────────────────────────────
    private Integer organizationScore;
    private Integer contentScore;
    private Integer animationScore;
    private Integer venueScore;
    private Integer scheduleScore;

    /** "Would you attend again?" (0..10, NPS-style). Optional. */
    private Integer npsLikelihood;

    /** Controlled keywords picked from the UI. Free text goes in `comment`. */
    private List<String> tags;

    /** Per-staff-member quick rating: { "Ahmed|formateur": 4, ... } */
    private java.util.Map<String, Integer> staffRatings;

    /** Free-text comment (optional, length-capped client-side). */
    private String comment;

    private LocalDateTime createdAt;

    // ── Getters / setters ────────────────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }

    public String getEventTitle() { return eventTitle; }
    public void setEventTitle(String eventTitle) { this.eventTitle = eventTitle; }

    public String getEventFormat() { return eventFormat; }
    public void setEventFormat(String eventFormat) { this.eventFormat = eventFormat; }

    public String getClubId() { return clubId; }
    public void setClubId(String clubId) { this.clubId = clubId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public Integer getOrganizationScore() { return organizationScore; }
    public void setOrganizationScore(Integer organizationScore) { this.organizationScore = organizationScore; }

    public Integer getContentScore() { return contentScore; }
    public void setContentScore(Integer contentScore) { this.contentScore = contentScore; }

    public Integer getAnimationScore() { return animationScore; }
    public void setAnimationScore(Integer animationScore) { this.animationScore = animationScore; }

    public Integer getVenueScore() { return venueScore; }
    public void setVenueScore(Integer venueScore) { this.venueScore = venueScore; }

    public Integer getScheduleScore() { return scheduleScore; }
    public void setScheduleScore(Integer scheduleScore) { this.scheduleScore = scheduleScore; }

    public Integer getNpsLikelihood() { return npsLikelihood; }
    public void setNpsLikelihood(Integer npsLikelihood) { this.npsLikelihood = npsLikelihood; }

    public List<String> getTags() { return tags; }
    public void setTags(List<String> tags) { this.tags = tags; }

    public java.util.Map<String, Integer> getStaffRatings() { return staffRatings; }
    public void setStaffRatings(java.util.Map<String, Integer> staffRatings) { this.staffRatings = staffRatings; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
