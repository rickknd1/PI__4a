package tn.esprit.clubhub.Entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "events")
public class Event {

    @Id
    private String id;

    private String title;
    private String description;

    // Support both camelCase and snake_case
    @Field("startDate")
    @JsonProperty("startDate")
    private LocalDateTime startDate;

    @Field("start_date")
    @JsonProperty("start_date")
    private LocalDateTime startDateSnake;

    @Field("endDate")
    @JsonProperty("endDate")
    private LocalDateTime endDate;

    @Field("end_date")
    @JsonProperty("end_date")
    private LocalDateTime endDateSnake;

    private EventLocation location;
    private Integer capacity;
    private String status;
    private String calendar;

    /** workshop, competition, conference, training, networking, trip_outing, other */
    @Field("event_format")
    @JsonProperty("eventFormat")
    private String eventFormat;

    /** When eventFormat is other */
    @Field("event_format_custom")
    @JsonProperty("eventFormatCustom")
    private String eventFormatCustom;

    @Field("createdBy")
    @JsonProperty("createdBy")
    private String createdBy;

    @Field("created_by")
    @JsonProperty("created_by")
    private String createdBySnake;

    @Field("createdAt")
    @JsonProperty("createdAt")
    private LocalDateTime createdAt;

    @Field("created_at")
    @JsonProperty("created_at")
    private LocalDateTime createdAtSnake;

    @Field("updatedAt")
    @JsonProperty("updatedAt")
    private LocalDateTime updatedAt;

    @Field("updated_at")
    @JsonProperty("updated_at")
    private LocalDateTime updatedAtSnake;

    @Field("rsvpCount")
    @JsonProperty("rsvpCount")
    private Integer rsvpCount;

    @Field("rsvp_count")
    @JsonProperty("rsvp_count")
    private Integer rsvpCountSnake;

    @Field("attendanceCount")
    @JsonProperty("attendanceCount")
    private Integer attendanceCount;

    @Field("attendance_count")
    @JsonProperty("attendance_count")
    private Integer attendanceCountSnake;

    private List<EventStaffMember> staff;

    @Field("is_deleted")
    @JsonProperty("is_deleted")
    private Boolean isDeleted = false;

    // Custom getters that check both formats
    public LocalDateTime getStartDate() {
        return startDate != null ? startDate : startDateSnake;
    }

    public void setStartDate(LocalDateTime startDate) {
        this.startDate = startDate;
        this.startDateSnake = startDate;
    }

    public LocalDateTime getEndDate() {
        return endDate != null ? endDate : endDateSnake;
    }

    public void setEndDate(LocalDateTime endDate) {
        this.endDate = endDate;
        this.endDateSnake = endDate;
    }

    public String getCreatedBy() {
        return createdBy != null ? createdBy : createdBySnake;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
        this.createdBySnake = createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt != null ? createdAt : createdAtSnake;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
        this.createdAtSnake = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt != null ? updatedAt : updatedAtSnake;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
        this.updatedAtSnake = updatedAt;
    }

    public Integer getRsvpCount() {
        Integer count = rsvpCount != null ? rsvpCount : rsvpCountSnake;
        return count != null ? count : 0;
    }

    public void setRsvpCount(Integer rsvpCount) {
        this.rsvpCount = rsvpCount;
        this.rsvpCountSnake = rsvpCount;
    }

    public Integer getAttendanceCount() {
        Integer count = attendanceCount != null ? attendanceCount : attendanceCountSnake;
        return count != null ? count : 0;
    }

    public void setAttendanceCount(Integer attendanceCount) {
        this.attendanceCount = attendanceCount;
        this.attendanceCountSnake = attendanceCount;
    }

    // Regular getters/setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public EventLocation getLocation() { return location; }
    public void setLocation(EventLocation location) { this.location = location; }

    public Integer getCapacity() { return capacity; }
    public void setCapacity(Integer capacity) { this.capacity = capacity; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCalendar() { return calendar; }
    public void setCalendar(String calendar) { this.calendar = calendar; }

    public String getEventFormat() { return eventFormat; }
    public void setEventFormat(String eventFormat) { this.eventFormat = eventFormat; }

    public String getEventFormatCustom() { return eventFormatCustom; }
    public void setEventFormatCustom(String eventFormatCustom) { this.eventFormatCustom = eventFormatCustom; }

    public List<EventStaffMember> getStaff() { return staff; }
    public void setStaff(List<EventStaffMember> staff) { this.staff = staff; }

    public Boolean getIsDeleted() { return isDeleted != null && isDeleted; }
    public void setIsDeleted(Boolean isDeleted) { this.isDeleted = isDeleted; }
}