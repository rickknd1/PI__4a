package clubhub.repository;

import clubhub.model.ConversationParticipant;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationParticipantRepository extends MongoRepository<ConversationParticipant, String> {
    List<ConversationParticipant> findByConversationId(String conversationId);
    List<ConversationParticipant> findByUserId(String userId);       // toutes les convs d'un user
    Optional<ConversationParticipant> findByConversationIdAndUserId(String conversationId, String userId);
}