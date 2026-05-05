package clubhub.repository;

import clubhub.model.GameLeaderboard;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface GameLeaderboardRepository extends MongoRepository<GameLeaderboard, String> {

    Optional<GameLeaderboard> findByGameSessionId(String gameSessionId);
}
