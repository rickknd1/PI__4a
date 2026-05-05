package clubhub.controller;

import clubhub.model.Message;
import clubhub.service.MessageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
public class MessageController {

    private final MessageService messageService;
    private final SimpMessagingTemplate messagingTemplate;

    public MessageController(MessageService messageService, SimpMessagingTemplate messagingTemplate) {
        this.messageService = messageService;
        this.messagingTemplate = messagingTemplate;
    }

    // Send a message
    @PostMapping("/{conversationId}/messages")
    public ResponseEntity<Message> sendMessage(
            @PathVariable String conversationId,
            @RequestBody Message message) {

        Message created = messageService.sendMessage(conversationId, message);
        if (created == null) {
            return ResponseEntity.notFound().build();
        }

        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, created);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // ==================== GET MESSAGES (Unified) ====================
    // This single method handles both cases:
    // - Without userId → returns all messages (old behavior)
    // - With userId   → returns only visible messages for that user (new "Archive" behavior)
    @GetMapping("/{conversationId}/messages")
    public ResponseEntity<List<Message>> getMessages(
            @PathVariable String conversationId,
            @RequestParam(required = false) String userId) {

        if (userId != null && !userId.isBlank()) {
            // New behavior: respect "Delete for me"
            List<Message> visibleMessages = messageService.getVisibleMessagesForUser(conversationId, userId);
            return ResponseEntity.ok(visibleMessages);
        } else {
            // Old behavior: return all messages
            List<Message> messages = messageService.getMessagesByConversation(conversationId);
            return ResponseEntity.ok(messages);
        }
    }

    // Get single message by ID
    @GetMapping("/{conversationId}/messages/{id}")
    public ResponseEntity<Message> getMessageById(
            @PathVariable String conversationId,
            @PathVariable String id) {

        return messageService.getMessageById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Update message
    @PutMapping("/{conversationId}/messages/{id}")
    public ResponseEntity<Message> updateMessage(
            @PathVariable String conversationId,
            @PathVariable String id,
            @RequestBody Message newData) {

        return messageService.updateMessage(id, newData)
                .map(updated -> {
                    messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, updated);
                    return ResponseEntity.ok(updated);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // Delete (unsend) message
    @DeleteMapping("/{conversationId}/messages/{id}")
    public ResponseEntity<Message> deleteMessage(
            @PathVariable String conversationId,
            @PathVariable String id) {

        return messageService.deleteMessage(id)
                .map(deleted -> {
                    messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, deleted);
                    return ResponseEntity.ok(deleted);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    // Mark message as read
    @PostMapping("/{conversationId}/messages/{messageId}/read")
    public ResponseEntity<Message> markMessageAsRead(
            @PathVariable String conversationId,
            @PathVariable String messageId,
            @RequestParam String userId) {

        return messageService.markMessageAsRead(messageId, userId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}