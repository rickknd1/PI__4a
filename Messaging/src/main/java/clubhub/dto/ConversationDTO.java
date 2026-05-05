package clubhub.dto;

// Crée ce fichier : src/main/java/com/clubhub/messaging/dto/ConversationDTO.java


import clubhub.model.Conversation;

public class ConversationDTO {

    private Conversation conversation;
    private String lastMessageContent;
    private String lastMessageSenderId;
    private String lastMessageAt;
    private int unreadCount;

    public ConversationDTO() {}

    public ConversationDTO(Conversation conversation, String lastMessageContent,
                           String lastMessageSenderId, String lastMessageAt,  int unreadCount) {
        this.conversation = conversation;
        this.lastMessageContent = lastMessageContent;
        this.lastMessageSenderId = lastMessageSenderId;
        this.lastMessageAt = lastMessageAt;
        this.unreadCount = unreadCount;
    }

    // Getters & Setters
    public Conversation getConversation() { return conversation; }
    public void setConversation(Conversation conversation) { this.conversation = conversation; }
    public String getLastMessageContent() { return lastMessageContent; }
    public void setLastMessageContent(String lastMessageContent) { this.lastMessageContent = lastMessageContent; }
    public String getLastMessageSenderId() { return lastMessageSenderId; }
    public void setLastMessageSenderId(String lastMessageSenderId) { this.lastMessageSenderId = lastMessageSenderId; }
    public String getLastMessageAt() { return lastMessageAt; }
    public void setLastMessageAt(String lastMessageAt) { this.lastMessageAt = lastMessageAt; }
}
