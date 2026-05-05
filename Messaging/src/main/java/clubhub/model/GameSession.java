package clubhub.model;



import clubhub.enums.Difficulty;
import clubhub.enums.GameStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "game_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GameSession {

    @Id
    private String id;                    // MongoDB ObjectId as String

    private String conversationId;        // Chat / Group ID
    private String createdBy;             // Admin userId who created the game

    private GameStatus status = GameStatus.WAITING;

    private String category;              // e.g. "Science", "Custom: Biology"
    private Difficulty difficulty = Difficulty.MEDIUM;

    private int totalQuestions;
    private int timeLimitPerQuestion;     // in seconds (10, 20, 30)

    private int currentQuestionIndex = 0;

    // Embedded questions
    private List<Question> questions = new ArrayList<>();

    // List of player userIds who joined
    private List<String> players = new ArrayList<>();

    private Instant startedAt;
    private Instant finishedAt;

    @CreatedDate
    private Instant createdAt = Instant.now();

    // Inner class for embedded Question
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Question {
        private int index;
        private String questionText;
        private List<String> options;           // exactly 4 options
        private String correctAnswer;           // must match one option exactly
        private String aiFunFact;
        private String aiWrongExplanation;
        private boolean revealed = false;
        private Instant revealedAt;
    }
}