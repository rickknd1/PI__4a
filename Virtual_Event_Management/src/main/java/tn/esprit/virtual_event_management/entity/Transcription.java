package tn.esprit.virtual_event_management.entity;

import org.springframework.data.annotation.Id;
import lombok.Data;
import lombok.*;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

@NoArgsConstructor
@AllArgsConstructor
@Data
@Document(collection = "transcription_pdfs")
public class Transcription {
    @Id
    private String id;

    private String content;

    private String pdfUrl;

    @DBRef
    private EventRecord eventRecord;  // généré depuis Record (1)
}
