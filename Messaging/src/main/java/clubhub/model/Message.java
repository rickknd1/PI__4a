package clubhub.model;



import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "messages")
public class Message {

    @Id
    private String id;

    private String conversationId;       // référence vers Conversation
    private String senderId;             // ✅ userId externe
    private String content;
    private TypeMessage type;
    private String parentMessageId;      // null si ce n'est pas une réponse
    private LocalDateTime createdAt;
    private boolean edited = false;
    private boolean deleted = false;
    private String parentMessageContent;

    // ✅ Embedded : les receipts vivent dans le même document MongoDB
    // Avantage : une seule lecture pour avoir le message + qui l'a lu
    private List<MessageReceipt> receipts = new ArrayList<>();

    public enum TypeMessage {
        TEXT, IMAGE, FILE
    }

    public Message() {}

    public Message(String conversationId, String senderId, String content, TypeMessage type) {
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.content = content;
        this.type = type;
        this.createdAt = LocalDateTime.now();
    }

    // Getters & Setters
    public String getId() { return id; }
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public TypeMessage getType() { return type; }
    public void setType(TypeMessage type) { this.type = type; }
    public String getParentMessageId() { return parentMessageId; }
    public void setParentMessageId(String parentMessageId) { this.parentMessageId = parentMessageId; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public boolean isEdited() { return edited; }
    public void setEdited(boolean edited) { this.edited = edited; }
    public boolean isDeleted() { return deleted; }
    public void setDeleted(boolean deleted) { this.deleted = deleted; }
    public List<MessageReceipt> getReceipts() { return receipts; }
    public void setReceipts(List<MessageReceipt> receipts) { this.receipts = receipts; }
    public String getParentMessageContent() { return parentMessageContent; }
    public void setParentMessageContent(String parentMessageContent) {
        this.parentMessageContent = parentMessageContent;
    }
}
