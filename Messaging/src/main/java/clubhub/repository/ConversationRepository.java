package clubhub.repository;

import clubhub.model.Conversation;
import clubhub.model.ConversationParticipant;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends MongoRepository<Conversation, String> {
    List<Conversation> findByCreatedByUserId(String userId);


}