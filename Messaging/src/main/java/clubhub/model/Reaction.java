package clubhub.model;


import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Document(collection = "reactions")
public class Reaction {

    @Id
    private String id;

    private String messageId;     // référence vers Message
    private String userId;        // ✅ ID utilisateur externe
    private EmojiType emoji;
    private LocalDateTime createdAt;

    public enum EmojiType {
        LIKE, LOVE, HAHA, NOTBAD, GREATJOB
    }

    public Reaction() {}

    public Reaction(String messageId, String userId, EmojiType emoji) {
        this.messageId = messageId;
        this.userId = userId;
        this.emoji = emoji;
        this.createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public EmojiType getEmoji() { return emoji; }
    public void setEmoji(EmojiType emoji) { this.emoji = emoji; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
