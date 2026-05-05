package clubhub.model;



import java.time.LocalDateTime;

// ✅ Pas de @Document ici — ce sera embedded directement dans Message
// MongoDB stockera cette classe à l'intérieur du document Message
public class MessageReceipt {

    private String userId;           // ✅ ID utilisateur externe
    private LocalDateTime readAt;

    public MessageReceipt() {}

    public MessageReceipt(String userId, LocalDateTime readAt) {
        this.userId = userId;
        this.readAt = readAt;
    }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    public LocalDateTime getReadAt() { return readAt; }
    public void setReadAt(LocalDateTime readAt) { this.readAt = readAt; }
}