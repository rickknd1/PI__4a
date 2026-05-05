package tn.esprit.virtual_event_management.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;
import java.util.List;

@Document(collection = "campaigns")
@Data
public class Email {
    @Id
    private String id;

    private String subject;
    private String content; // HTML avec {{nom}}

    private List<String> userIds;

    private Date scheduledAt;
    private boolean sent;
}
