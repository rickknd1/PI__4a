package tn.esprit.virtual_event_management.entity;
import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Document(collection = "event_reviews")
public class EventReview {
    @Id
    private String id;

    private String eventId;
    private String userId;
    private String userName;

    private int rating;
    private String comment;

    private boolean approved;
    private boolean flagged;
    private String reason;

    private LocalDateTime createdAt;
}
