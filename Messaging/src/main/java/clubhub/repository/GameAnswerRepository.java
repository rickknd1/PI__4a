package clubhub.repository;



import clubhub.model.GameAnswer;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GameAnswerRepository extends MongoRepository<GameAnswer, String> {
    long countByGameSessionIdAndQuestionIndex(String gameSessionId, int questionIndex);
    List<GameAnswer> findByGameSessionIdAndQuestionIndex(String gameSessionId, int questionIndex);
    boolean existsByGameSessionIdAndQuestionIndexAndUserId(String gameSessionId, int questionIndex, String userId);
    List<GameAnswer> findByGameSessionId(String gameSessionId);
}
