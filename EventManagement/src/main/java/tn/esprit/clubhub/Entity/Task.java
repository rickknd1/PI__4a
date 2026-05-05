package tn.esprit.clubhub.Entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "tasks")
public class Task {

    @Id
    private String id;

    private String eventId;
    private String title;
    private String description;
    private String assignedTo;
    private String assigneeName;
    private String assigneeAvatar;
    private String priority = "normal";
    private String status = "todo";
    private String dueDate;
    private String createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // ── Completion metadata (filled when a task is marked done) ────────────
    private String completionNote;          // Short summary: "what was accomplished"
    private String completionOutcome;       // success | partial | skipped
    private String completionReason;        // Required when completed late / skipped
    private LocalDateTime completedAt;


    public Task() {}

    public Task(String id, String eventId, String title, String description,
                String assignedTo, String assigneeName, String assigneeAvatar,
                String priority, String status, String dueDate,
                String createdBy, LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.eventId = eventId;
        this.title = title;
        this.description = description;
        this.assignedTo = assignedTo;
        this.assigneeName = assigneeName;
        this.assigneeAvatar = assigneeAvatar;
        this.priority = priority;
        this.status = status;
        this.dueDate = dueDate;
        this.createdBy = createdBy;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }


    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getAssignedTo() { return assignedTo; }
    public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }

    public String getAssigneeName() { return assigneeName; }
    public void setAssigneeName(String assigneeName) { this.assigneeName = assigneeName; }

    public String getAssigneeAvatar() { return assigneeAvatar; }
    public void setAssigneeAvatar(String assigneeAvatar) { this.assigneeAvatar = assigneeAvatar; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getDueDate() { return dueDate; }
    public void setDueDate(String dueDate) { this.dueDate = dueDate; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public String getCompletionNote() { return completionNote; }
    public void setCompletionNote(String completionNote) { this.completionNote = completionNote; }

    public String getCompletionOutcome() { return completionOutcome; }
    public void setCompletionOutcome(String completionOutcome) { this.completionOutcome = completionOutcome; }

    public String getCompletionReason() { return completionReason; }
    public void setCompletionReason(String completionReason) { this.completionReason = completionReason; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}