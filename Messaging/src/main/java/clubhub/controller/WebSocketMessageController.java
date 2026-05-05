package clubhub.controller;
import clubhub.dto.ChatMessageDTO;
import clubhub.model.Message;
import clubhub.service.MessageService;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import java.time.LocalDateTime;

@Controller
public class WebSocketMessageController {

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageService messageService;

    public WebSocketMessageController(SimpMessagingTemplate messagingTemplate,
                                      MessageService messageService) {
        this.messagingTemplate = messagingTemplate;
        this.messageService = messageService;
    }

    // Reçoit les messages depuis /app/chat.send
    @MessageMapping("/chat.send")
    public void sendMessage(@Payload ChatMessageDTO dto) {

        // 1. Sauvegarde en base
        Message message = new Message(
                dto.getConversationId(),
                dto.getSenderId(),
                dto.getContent(),
                Message.TypeMessage.valueOf(dto.getType() != null ? dto.getType() : "TEXT")
        );

        if (dto.getParentMessageId() != null) {
            message.setParentMessageId(dto.getParentMessageId());
        }

        Message saved = messageService.sendMessage(dto.getConversationId(), message);

        if (saved != null) {
            // 2. Broadcast à tous les abonnés de cette conversation
            messagingTemplate.convertAndSend(
                    "/topic/conversation/" + dto.getConversationId(),
                    saved
            );
        }
    }

    // Notifie quand un message est modifié
    @MessageMapping("/chat.edit")
    public void editMessage(@Payload Message message) {
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + message.getConversationId(),
                message
        );
    }

    // Notifie quand un message est supprimé
    @MessageMapping("/chat.delete")
    public void deleteMessage(@Payload Message message) {
        messagingTemplate.convertAndSend(
                "/topic/conversation/" + message.getConversationId(),
                message
        );
    }
}