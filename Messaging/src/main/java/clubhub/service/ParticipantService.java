package clubhub.service;

import clubhub.model.ConversationParticipant;
import clubhub.model.Message;
import clubhub.repository.ConversationParticipantRepository;
import clubhub.repository.ConversationRepository;
import clubhub.repository.MessageRepository;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ParticipantService {
    private final ConversationParticipantRepository participantRepository;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    public ParticipantService(ConversationParticipantRepository participantRepository,
                              ConversationRepository conversationRepository, MessageRepository messageRepository) {
        this.participantRepository = participantRepository;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    // Ajouter un participant
    public ConversationParticipant addParticipant(String conversationId, ConversationParticipant participant) {
        // Vérifier que la conversation existe
        if (!conversationRepository.existsById(conversationId)) {
            return null;
        }

        // Vérifier que l'utilisateur n'est pas déjà dans la conversation
        Optional<ConversationParticipant> existing =
                participantRepository.findByConversationIdAndUserId(conversationId, participant.getUserId());

        if (existing.isPresent()) {
            return null; // déjà participant
        }

        participant.setConversationId(conversationId);

        return participantRepository.save(participant);
    }

    // Récupérer tous les participants d'une conversation
    public List<ConversationParticipant> getParticipants(String conversationId) {
        return participantRepository.findByConversationId(conversationId);
    }

    // Récupérer un participant par son ID
    public Optional<ConversationParticipant> getParticipantById(String id) {
        return participantRepository.findById(id);
    }

    // Modifier le rôle d'un participant
    public Optional<ConversationParticipant> updateParticipant(String id, ConversationParticipant newData) {
        return participantRepository.findById(id).map(existing -> {
            existing.setRole(newData.getRole()); // on modifie uniquement le rôle
            return participantRepository.save(existing);
        });
    }

    // Retirer un participant de la conversation
    public boolean removeParticipant(String id) {
        if (participantRepository.existsById(id)) {
            participantRepository.deleteById(id);
            return true;
        }
        return false;
    }
    public Map<String, String> leaveConversation(String conversationId, String userId) {
        Map<String, String> result = new HashMap<>();

        Optional<ConversationParticipant> me =
                participantRepository.findByConversationIdAndUserId(conversationId, userId);

        if (me.isEmpty()) {
            result.put("error", "Participant introuvable");
            return result;
        }

        // Si SUPERADMIN — il doit d'abord transférer son rôle
        if (me.get().getRole() == ConversationParticipant.RoleParticipant.SUPERADMIN) {
            result.put("error", "TRANSFER_REQUIRED");
            return result;
        }

        participantRepository.delete(me.get());
        result.put("success", "true");
        return result;
    }
    // Transférer le rôle SUPERADMIN à un autre participant
    public boolean transferSuperAdmin(String conversationId, String fromUserId, String toUserId) {

        Optional<ConversationParticipant> from =
                participantRepository.findByConversationIdAndUserId(conversationId, fromUserId);

        Optional<ConversationParticipant> to =
                participantRepository.findByConversationIdAndUserId(conversationId, toUserId);

        if (from.isEmpty() || to.isEmpty()) return false;
        if (from.get().getRole() != ConversationParticipant.RoleParticipant.SUPERADMIN) return false;

        // Transfère le rôle
        from.get().setRole(ConversationParticipant.RoleParticipant.MEMBRE);
        to.get().setRole(ConversationParticipant.RoleParticipant.SUPERADMIN);

        participantRepository.save(from.get());
        participantRepository.save(to.get());

        return true;
    }
    // Marquer tous les messages comme lus
    public boolean markAsRead(String conversationId, String userId) {
        Optional<ConversationParticipant> participant =
                participantRepository.findByConversationIdAndUserId(conversationId, userId);

        if (participant.isEmpty()) return false;

        // On met à jour le lastReadMessageId avec le dernier message
        List<Message> messages = messageRepository
                .findByConversationIdOrderByCreatedAtAsc(conversationId);

        if (!messages.isEmpty()) {
            Message last = messages.get(messages.size() - 1);
            participant.get().setLastReadMessageId(last.getId());
            participantRepository.save(participant.get());
        }
        return true;
    }




}
