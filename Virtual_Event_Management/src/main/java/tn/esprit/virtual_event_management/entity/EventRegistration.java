package tn.esprit.virtual_event_management.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "event_registrations")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class EventRegistration {
    @Id
    private String id;

    private String eventId;  // 🔥 référence simple
    private String userId;   // 🔥 user externe

    private boolean paid;

    private boolean joined = false;

}
