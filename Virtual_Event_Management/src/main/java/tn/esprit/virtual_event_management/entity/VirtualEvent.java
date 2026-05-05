package tn.esprit.virtual_event_management.entity;

import org.springframework.data.annotation.Id;
import lombok.*;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Document(collection = "virtual_events")
public class VirtualEvent {
    @Id
    private String id;

    // 🔹 Basic info
    private String title;
    private String description;
    private String category; // ex: Tech, Business, Gaming

    // 🔹 Date & Time
    private LocalDateTime scheduledAt;
    private LocalDateTime endAt;

    // 🔹 Meeting
    private String meetingLink; // generer automatiquemant avec jitsi
    private Boolean isRecording;

    // 🔹 Pricing
    private Double price;
    private Boolean isPaid;

    // 🔹 Capacity
    private Integer maxParticipants;
    private Integer currentParticipants;

    // 🔹 Media
    private String imageUrl;

    // 🔹 Status
    private String status;
    // UPCOMING, ONGOING, FINISHED, CANCELLED

    // 🔹 Organizer
    @DBRef
    private User organizer;

    // 🔹 Participants (optionnel)
    @DBRef
    private List<User> participants;

    // 🔹 Metadata
    private LocalDateTime createdAt;

    private String type;   // VIRTUAL ou ROOM
    private String roomId;

    private Boolean reminderSent = false;

    public Integer getSafeParticipants() {
        return currentParticipants != null ? currentParticipants : 0;
    }

}
