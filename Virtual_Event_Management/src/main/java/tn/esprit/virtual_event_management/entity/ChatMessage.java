package tn.esprit.virtual_event_management.entity;

import lombok.Data;

@Data
public class ChatMessage {
    private String roomId;
    private String user;
    private String message;
    private String senderId;
}
