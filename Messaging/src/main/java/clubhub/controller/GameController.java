package clubhub.controller;



import clubhub.enums.Difficulty;
import clubhub.model.GameSession;
import clubhub.service.GameService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/games")

public class GameController {

    private final GameService gameService;

    public GameController(GameService gameService) {
        this.gameService = gameService;
    }

    // ====================== CREATE GAME ======================
    @PostMapping("/create")
    public ResponseEntity<?> createGame(@RequestBody CreateGameRequest request) {
        try {
            GameSession game = gameService.createGame(
                    request.getConversationId(),
                    request.getCreatedBy(),
                    request.getCategory(),
                    request.getDifficulty(),
                    request.getTotalQuestions(),
                    request.getTimeLimitPerQuestion()
            );
            return ResponseEntity.ok(game); // game is never null here
        } catch (IllegalStateException e) {
            // Return 409 Conflict with error message — NOT null body with 400
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to create game: " + e.getMessage()));
        }
    }

    // ====================== JOIN GAME ======================
    @PostMapping("/{gameId}/join")
    public ResponseEntity<?> joinGame(@PathVariable String gameId,
                                      @RequestParam String userId) {
        try {
            GameSession game = gameService.joinGame(gameId, userId);
            return ResponseEntity.ok(game);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage())); // ← shows reason
        }
    }

    // ====================== START GAME (Admin only) ======================
    @PostMapping("/{gameId}/start")
    public ResponseEntity<?> startGame(@PathVariable String gameId,
                                       @RequestParam String adminUserId) {
        try {
            GameSession game = gameService.startGame(gameId, adminUserId);
            return ResponseEntity.ok(game);
        } catch (IllegalStateException e) {
            // ✅ FIXED: Return the error message so frontend can show it
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Failed to start game: " + e.getMessage()));
        }
    }

    // ====================== SUBMIT ANSWER ======================
    @PostMapping("/{gameId}/answer")
    public ResponseEntity<Void> submitAnswer(@PathVariable String gameId,
                                             @RequestBody SubmitAnswerRequest request) {
        try {
            gameService.submitAnswer(
                    gameId,
                    request.getQuestionIndex(),
                    request.getUserId(),
                    request.getSelectedAnswer(),
                    request.getResponseTimeMs()
            );
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().build();
        }
    }

    // ====================== GET ACTIVE GAME ======================
    @GetMapping("/conversation/{conversationId}/active")
    public ResponseEntity<GameSession> getActiveGame(@PathVariable String conversationId) {
        return gameService.getActiveGameForConversation(conversationId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // ====================== GET GAME HISTORY ======================
    @GetMapping("/conversation/{conversationId}/history")
    public ResponseEntity<List<GameSession>> getGameHistory(@PathVariable String conversationId) {
        // TODO: Implement in repository if needed
        return ResponseEntity.ok(List.of()); // placeholder
    }

    // ====================== DTOs ======================

    public static class CreateGameRequest {
        private String conversationId;
        private String createdBy;
        private String category;
        private Difficulty difficulty;
        private int totalQuestions;
        private int timeLimitPerQuestion;

        // Getters and Setters
        public String getConversationId() { return conversationId; }
        public void setConversationId(String conversationId) { this.conversationId = conversationId; }

        public String getCreatedBy() { return createdBy; }
        public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }

        public Difficulty getDifficulty() { return difficulty; }
        public void setDifficulty(Difficulty difficulty) { this.difficulty = difficulty; }

        public int getTotalQuestions() { return totalQuestions; }
        public void setTotalQuestions(int totalQuestions) { this.totalQuestions = totalQuestions; }

        public int getTimeLimitPerQuestion() { return timeLimitPerQuestion; }
        public void setTimeLimitPerQuestion(int timeLimitPerQuestion) { this.timeLimitPerQuestion = timeLimitPerQuestion; }
    }

    public static class SubmitAnswerRequest {
        private int questionIndex;
        private String userId;
        private String selectedAnswer;
        private long responseTimeMs;

        // Getters and Setters
        public int getQuestionIndex() { return questionIndex; }
        public void setQuestionIndex(int questionIndex) { this.questionIndex = questionIndex; }

        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }

        public String getSelectedAnswer() { return selectedAnswer; }
        public void setSelectedAnswer(String selectedAnswer) { this.selectedAnswer = selectedAnswer; }

        public long getResponseTimeMs() { return responseTimeMs; }
        public void setResponseTimeMs(long responseTimeMs) { this.responseTimeMs = responseTimeMs; }
    }
}