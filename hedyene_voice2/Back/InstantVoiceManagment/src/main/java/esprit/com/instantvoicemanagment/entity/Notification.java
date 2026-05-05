package esprit.com.instantvoicemanagment.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "notifications")
public class Notification {

    @Id
    private String id;

    private String userId;          // recipient (the reporter who filed the report)
    private String message;
    private String reportId;
    private String reportedUserId;  // the person who was reported (for redirect link)
    private boolean read = false;
    private LocalDateTime createdAt = LocalDateTime.now();
}
