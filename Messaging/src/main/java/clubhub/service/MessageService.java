package clubhub.service;

import clubhub.model.ConversationParticipant;
import clubhub.model.Message;
import clubhub.model.MessageReceipt;
import clubhub.repository.ConversationParticipantRepository;
import clubhub.repository.ConversationRepository;
import clubhub.repository.MessageRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class MessageService {
    private final MessageRepository messageRepository;
    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;

    public MessageService(MessageRepository messageRepository,
                          ConversationRepository conversationRepository ,ConversationParticipantRepository  participantRepository) {
        this.messageRepository = messageRepository;
        this.conversationRepository = conversationRepository;
        this.participantRepository = participantRepository;
    }
    public Message sendMessage(String conversationId, Message message) {
        // On vérifie que la conversation existe avant d'envoyer un message
        if (!conversationRepository.existsById(conversationId)) {
            return null; // la conversation n'existe pas
        }

        message.setConversationId(conversationId);
        message.setEdited(false);
        message.setDeleted(false);
        if (message.getParentMessageId() != null) {
            messageRepository.findById(message.getParentMessageId())
                    .ifPresent(parent -> message.setParentMessageContent(parent.getContent()));
        }



        return messageRepository.save(message);
    }
    // Dans MessageService.java — ajoute ces méthodes



    // Récupérer tous les messages d'une conversation
    public List<Message> getMessagesByConversation(String conversationId) {
        return messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
    }

    // Récupérer un message par son ID
    public Optional<Message> getMessageById(String id) {
        return messageRepository.findById(id);
    }

    // Modifier un message
    public Optional<Message> updateMessage(String id, Message newData) {
        return messageRepository.findById(id).map(existing -> {
            // On ne modifie que le contenu
            existing.setContent(newData.getContent());
            existing.setEdited(true); // on marque le message comme modifié
            return messageRepository.save(existing);
        });
    }

    // Supprimer un message (soft delete — on ne supprime pas vraiment)
    public Optional<Message> deleteMessage(String id) {
        return messageRepository.findById(id).map(existing -> {
            existing.setDeleted(true);
            existing.setContent("Ce message a été supprimé.");
            return messageRepository.save(existing);
        });
    }
    public Optional<Message> markMessageAsRead(String messageId, String userId) {
        return messageRepository.findById(messageId).map(message -> {

            if (message.getSenderId().equals(userId)) {
                return message; // do not mark own messages
            }

            boolean alreadyRead = message.getReceipts().stream()
                    .anyMatch(r -> r.getUserId().equals(userId));

            if (!alreadyRead) {
                message.getReceipts().add(
                        new MessageReceipt(userId, LocalDateTime.now())
                );
                messageRepository.save(message);
            }

            return message;
        });
    }
    public List<Message> getVisibleMessagesForUser(String conversationId, String userId) {
        // Get all messages
        List<Message> allMessages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);

        // Check if user has hidden messages
        Optional<ConversationParticipant> participantOpt =
                participantRepository.findByConversationIdAndUserId(conversationId, userId);

        if (participantOpt.isEmpty() || !participantOpt.get().isMessagesHidden()) {
            // No hide → return all non-deleted messages
            return allMessages.stream()
                    .filter(m -> !m.isDeleted())
                    .collect(Collectors.toList());
        }

        // User has hidden messages → filter only messages AFTER hiddenAt
        LocalDateTime hiddenAt = participantOpt.get().getMessagesHiddenAt();

        return allMessages.stream()
                .filter(m -> !m.isDeleted())
                .filter(m -> m.getCreatedAt() != null && m.getCreatedAt().isAfter(hiddenAt))
                .collect(Collectors.toList());
    }




}
