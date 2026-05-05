package clubhub.repository;


import clubhub.enums.GameStatus;
import clubhub.model.GameSession;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GameSessionRepository extends MongoRepository<GameSession, String> {

    Optional<GameSession> findByConversationIdAndStatus(String conversationId, GameStatus status);

    List<GameSession> findByConversationIdOrderByCreatedAtDesc(String conversationId);

    // Useful for checking active game
    Optional<GameSession> findFirstByConversationIdAndStatusInOrderByCreatedAtDesc(
            String conversationId, List<GameStatus> statuses);
}
