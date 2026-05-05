package clubhub.model;



import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;

@Document(collection = "conversation_participants")
public class ConversationParticipant {

    @Id
    private String id;

    private String conversationId;   // référence vers Conversation
    private String userId;           // ✅ ID de l'utilisateur (User service externe)
    private RoleParticipant role;
    private LocalDateTime joinedAt;
    private String lastReadMessageId;
    private boolean messagesHidden = false;   // or call it "deletedForMe"
    private LocalDateTime messagesHiddenAt;

    public enum RoleParticipant {
        ADMIN, MEMBRE, SUPERADMIN
    }

    public ConversationParticipant() {}

    public ConversationParticipant(String conversationId, String userId, RoleParticipant role) {
        this.conversationId = conversationId;
        this.userId = userId;
        this.role = role;
        this.joinedAt = LocalDateTime.now();
    }

    // Getters & Setters
    public String getId() { return id; }
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public RoleParticipant getRole() { return role; }
    public void setRole(RoleParticipant role) { this.role = role; }
    public LocalDateTime getJoinedAt() { return joinedAt; }
    public String getLastReadMessageId() { return lastReadMessageId; }
    public void setLastReadMessageId(String lastReadMessageId) { this.lastReadMessageId = lastReadMessageId; }
    public boolean isMessagesHidden() {
        return Boolean.TRUE.equals(messagesHidden);   // returns false if null or false
    }

    public void setMessagesHidden(boolean messagesHidden) {
        this.messagesHidden = messagesHidden;
        this.messagesHiddenAt = messagesHidden ? LocalDateTime.now() : null;
    }

    public LocalDateTime getMessagesHiddenAt() {
        return messagesHiddenAt;
    }
}