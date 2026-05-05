package clubhub.dto;



public class ChatMessageDTO {

    private String conversationId;
    private String senderId;
    private String content;
    private String type;           // TEXT, IMAGE, FILE
    private String parentMessageId; // pour les réponses

    public ChatMessageDTO() {}

    // Getters & Setters
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getParentMessageId() { return parentMessageId; }
    public void setParentMessageId(String parentMessageId) { this.parentMessageId = parentMessageId; }
}
