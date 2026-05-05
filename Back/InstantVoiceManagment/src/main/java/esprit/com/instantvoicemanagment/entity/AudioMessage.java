package esprit.com.instantvoicemanagment.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "audioMessages")
public class AudioMessage {

    @Id
    private String id;

    private String channelId;
    private String userId;
    private String userName;

    private String audioData;   // base64-encoded audio bytes
    private String contentType; // e.g. audio/webm

    private LocalDateTime createdAt = LocalDateTime.now();

    private boolean aiModerated = false;

    private boolean hidden = false;
}
