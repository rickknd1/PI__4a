package clubhub.model;



import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Document(collection = "game_answers")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GameAnswer {

    @Id
    private String id;

    private String gameSessionId;
    private int questionIndex;
    private String userId;

    private String selectedAnswer;
    private boolean isCorrect;
    private long responseTimeMs;        // time taken to answer
    private int pointsEarned;           // calculated using the formula

    @CreatedDate
    private Instant submittedAt = Instant.now();
}