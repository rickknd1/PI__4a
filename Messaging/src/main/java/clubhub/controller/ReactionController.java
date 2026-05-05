package clubhub.controller;

import clubhub.model.Reaction;
import clubhub.service.ReactionService;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.fasterxml.jackson.databind.ObjectMapper;


import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController

@RequestMapping("/api/conversations/{conversationId}/messages/{messageId}/reactions")
public class ReactionController {

    private final ReactionService reactionService;
    private final SimpMessagingTemplate messagingTemplate;

    public ReactionController(ReactionService reactionService,
                              SimpMessagingTemplate messagingTemplate) {
        this.reactionService = reactionService;
        this.messagingTemplate = messagingTemplate;
    }

    @PostMapping
    public ResponseEntity<List<Reaction>> toggleReaction(
            @PathVariable String conversationId,
            @PathVariable String messageId,
            @RequestBody Map<String, String> body) {

        String userId = body.get("userId");
        Reaction.EmojiType emoji = Reaction.EmojiType.valueOf(body.get("emoji"));

        List<Reaction> updated = reactionService.toggleReaction(messageId, userId, emoji);

        // Create payload
        Map<String, Object> payload = new HashMap<>();
        payload.put("messageId", messageId);
        payload.put("reactions", updated != null ? updated : List.of());

        try {
            // Convert to JSON string manually
            ObjectMapper objectMapper = new ObjectMapper();
            String json = objectMapper.writeValueAsString(payload);

            // Send as String → guarantees the body is not null
            messagingTemplate.convertAndSend("/topic/reactions/" + messageId, json);

            System.out.println("✅ BROADCAST SENT | messageId=" + messageId + " | reactions=" + updated.size());
        } catch (Exception e) {
            System.err.println("Failed to send reaction broadcast: " + e.getMessage());
        }

        return ResponseEntity.ok(updated);
    }
    @GetMapping
    public ResponseEntity<List<Reaction>> getReactions(
            @PathVariable String conversationId,
            @PathVariable String messageId) {

        List<Reaction> reactions = reactionService.getReactionsByMessageId(messageId);
        return ResponseEntity.ok(reactions != null ? reactions : Collections.emptyList());
    }
}