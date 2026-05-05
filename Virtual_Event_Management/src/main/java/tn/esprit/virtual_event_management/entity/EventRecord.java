package tn.esprit.virtual_event_management.entity;


import org.springframework.data.annotation.Id;
import lombok.*;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;


@AllArgsConstructor
@NoArgsConstructor
@Data
@Document(collection = "records")
public class EventRecord {
    @Id
    private String id;

    private String fileUrl;

    private Boolean gdprConsent;

    @DBRef
    private VirtualEvent virtualEvent;  // possède (0..1)
}
