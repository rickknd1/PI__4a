package clubhub.repository;

import clubhub.model.Reaction;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface ReactionRepository extends MongoRepository<Reaction, String> {
    List<Reaction> findByMessageId(String messageId);
    Optional<Reaction> findByMessageIdAndUserId(String messageId, String userId);
    void deleteByMessageIdAndUserId(String messageId, String userId);
    Optional<Reaction> findByMessageIdAndUserIdAndEmoji(
            String messageId, String userId, Reaction.EmojiType emoji);
}