package clubhub.controller;



import clubhub.model.ConversationParticipant;
import clubhub.service.ParticipantService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/conversations/{conversationId}/participants")

public class ParticipantController {

    private final ParticipantService participantService;

    public ParticipantController(ParticipantService participantService) {
        this.participantService = participantService;
    }

    // POST /api/conversations/{conversationId}/participants
    @PostMapping
    public ResponseEntity<ConversationParticipant> addParticipant(
            @PathVariable String conversationId,
            @RequestBody ConversationParticipant participant) {

        ConversationParticipant created = participantService.addParticipant(conversationId, participant);

        if (created == null) {
            // conversation inexistante OU participant déjà présent
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    // GET /api/conversations/{conversationId}/participants
    @GetMapping
    public ResponseEntity<List<ConversationParticipant>> getParticipants(
            @PathVariable String conversationId) {

        List<ConversationParticipant> participants = participantService.getParticipants(conversationId);
        return ResponseEntity.ok(participants);
    }

    // GET /api/conversations/{conversationId}/participants/{id}
    @GetMapping("/{id}")
    public ResponseEntity<ConversationParticipant> getParticipantById(
            @PathVariable String conversationId,
            @PathVariable String id) {

        return participantService.getParticipantById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // PUT /api/conversations/{conversationId}/participants/{id}
    @PutMapping("/{id}")
    public ResponseEntity<ConversationParticipant> updateParticipant(
            @PathVariable String conversationId,
            @PathVariable String id,
            @RequestBody ConversationParticipant newData) {

        return participantService.updateParticipant(id, newData)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // DELETE /api/conversations/{conversationId}/participants/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> removeParticipant(
            @PathVariable String conversationId,
            @PathVariable String id) {

        if (participantService.removeParticipant(id)) {
            return ResponseEntity.noContent().build(); // 204
        }
        return ResponseEntity.notFound().build(); // 404
    }
    @PostMapping("/leave")
    public ResponseEntity<Map<String, String>> leaveConversation(
            @PathVariable String conversationId,
            @RequestParam String userId) {

        Map<String, String> result = participantService.leaveConversation(conversationId, userId);

        if (result.containsKey("error")) {
            return ResponseEntity.badRequest().body(result);
        }
        return ResponseEntity.ok(result);
    }
    @PostMapping("/transfer")
    public ResponseEntity<Void> transferSuperAdmin(
            @PathVariable String conversationId,
            @RequestParam String fromUserId,
            @RequestParam String toUserId) {

        boolean done = participantService.transferSuperAdmin(conversationId, fromUserId, toUserId);

        if (done) return ResponseEntity.ok().build();
        return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
    }
    // POST /api/conversations/{conversationId}/participants/read?userId=...
    @PostMapping("/read")
    public ResponseEntity<Void> markAsRead(
            @PathVariable String conversationId,
            @RequestParam String userId) {

        boolean done = participantService.markAsRead(conversationId, userId);
        if (done) return ResponseEntity.ok().build();
        return ResponseEntity.notFound().build();
    }


}

