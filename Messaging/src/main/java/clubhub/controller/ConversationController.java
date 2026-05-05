package clubhub.controller;
import clubhub.dto.ConversationDTO;
import clubhub.model.Conversation;
import clubhub.service.ConversationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;


@RestController

@RequestMapping("/api/conversations")
public class ConversationController {
    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    // POST /api/conversations
    @PostMapping
    public ResponseEntity<Conversation> createConversation(@RequestBody Conversation conversation) {
        Conversation created = conversationService.createConversation(conversation);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
    @GetMapping
    public ResponseEntity<List<ConversationDTO>> getAllConversations(
            @RequestParam(required = false, defaultValue = "user-alice-001") String userId) {
        return ResponseEntity.ok(conversationService.getAllWithLastMessage(userId));
    }

    // GET /api/conversations/{id}
    @GetMapping("/{id}")
    public ResponseEntity<Conversation> getConversationById(@PathVariable String id) {
        return conversationService.getConversationById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    // Dans ConversationController.java — ajoute ces deux méthodes

    // PUT /api/conversations/{id}
    @PutMapping("/{id}")
    public ResponseEntity<Conversation> updateConversation(
            @PathVariable String id,
            @RequestBody Conversation newData) {

        return conversationService.updateConversation(id, newData)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // DELETE /api/conversations/{id}?userId=user-alice-001
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteConversation(
            @PathVariable String id,
            @RequestParam String userId) {

        boolean deleted = conversationService.deleteConversationBySuperAdmin(id, userId);

        if (deleted) {
            return ResponseEntity.noContent().build(); // 204
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build(); // 403
    }

    // POST /api/conversations/private?userId1=...&userId2=...
    @PostMapping("/private")
    public ResponseEntity<Conversation> createPrivateConversation(
            @RequestParam String userId1,
            @RequestParam String userId2) {

        if (userId1.equals(userId2)) {
            return ResponseEntity.badRequest().build();
        }

        Conversation conv = conversationService.createPrivateConversation(userId1, userId2);
        return ResponseEntity.status(HttpStatus.CREATED).body(conv);
    }
    @PatchMapping("/{id}/name")
    public ResponseEntity<Conversation> updateName(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {

        String newName = body.get("name");
        if (newName == null || newName.isBlank()) return ResponseEntity.badRequest().build();

        return conversationService.updateName(id, newName)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    @PatchMapping("/{id}/photo-url")
    public ResponseEntity<Conversation> updatePhotoUrl(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {

        String photoUrl = body.get("photoUrl");
        if (photoUrl == null || photoUrl.isBlank()) return ResponseEntity.badRequest().build();

        return conversationService.updatePhotoUrl(id, photoUrl)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }



    // DELETE /api/conversations/{id}/messages (Delete for me)
    @DeleteMapping("/{id}/messages")
    public ResponseEntity<Void> hideMessagesForUser(
            @PathVariable String id,
            @RequestParam String userId) {

        boolean done = conversationService.hideMessagesForUser(id, userId);
        if (done) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    @PutMapping("/{conversationId}/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable String conversationId,
            @RequestBody Map<String, String> request) {

        String userId = request.get("userId");
        if (userId == null || userId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        boolean success = conversationService.markAsRead(conversationId, userId);
        return success ? ResponseEntity.ok().build() : ResponseEntity.notFound().build();
    }


}
