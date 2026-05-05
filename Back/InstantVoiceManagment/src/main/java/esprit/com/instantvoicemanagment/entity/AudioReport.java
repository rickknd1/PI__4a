package esprit.com.instantvoicemanagment.entity;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Data
@Document(collection = "audioReports")
public class AudioReport {

    @Id
    private String id;

    private String audioMessageId;
    private String channelId;
    private String channelName;

    private String reportedByUserId;
    private String reportedByUserName;

    private String reportedUserId;
    private String reportedUserName;

    private String audioData;    // base64-encoded audio (copied from the AudioMessage)
    private String contentType;  // e.g. audio/webm

    private String reason;   // INAPPROPRIATE, HARASSMENT, SPAM, OTHER
    private String details;  // optional free text

    private String status = "PENDING"; // PENDING, REVIEWED, DISMISSED

    // Decision written by bureau member
    private String decisionType;  // WARNING, DELETE_AUDIO
    private String decisionText;
    private LocalDateTime treatedAt;

    private LocalDateTime createdAt = LocalDateTime.now();

    // AI moderation metadata
    private boolean aiGenerated = false;
    private double aiConfidence;
    private String aiTranscript;
}
