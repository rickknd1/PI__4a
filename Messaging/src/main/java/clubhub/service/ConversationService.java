package clubhub.service;
import clubhub.dto.ConversationDTO;
import clubhub.model.Conversation;
import clubhub.model.ConversationParticipant;
import clubhub.model.Message;
import clubhub.repository.ConversationParticipantRepository;
import clubhub.repository.ConversationRepository;
import clubhub.repository.MessageRepository;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ConversationParticipantRepository participantRepository;
    private final MessageRepository messageRepository;
    // Spring injecte automatiquement le repository ici
    public ConversationService(ConversationRepository conversationRepository , ConversationParticipantRepository participantRepository, MessageRepository messageRepository) {
        this.conversationRepository = conversationRepository;
        this.participantRepository = participantRepository;
        this.messageRepository = messageRepository;
    }

    public Conversation createConversation(Conversation conversation) {
        conversation.setCreatedAt(LocalDateTime.now());
        Conversation saved = conversationRepository.save(conversation);

        // ✅ Créateur devient automatiquement SuperADMIN
        ConversationParticipant creator = new ConversationParticipant(
                saved.getId(),
                saved.getCreatedByUserId(),
                ConversationParticipant.RoleParticipant.SUPERADMIN
        );
        participantRepository.save(creator);

        return saved;
    }
    // Récupérer toutes les conversations
    public List<Conversation> getAllConversations() {
        return conversationRepository.findAll();
    }

    // Récupérer une conversation par son ID
    public Optional<Conversation> getConversationById(String id) {
        return conversationRepository.findById(id);
    }
    // Dans ConversationService.java — ajoute ces deux méthodes

    // Modifier une conversation
    public Optional<Conversation> updateConversation(String id, Conversation newData) {
        return conversationRepository.findById(id).map(existing -> {
            // On met à jour uniquement les champs modifiables
            existing.setNom(newData.getNom());
            existing.setDescription(newData.getDescription());
            existing.setType(newData.getType());
            // On ne touche PAS à createdAt ni createdByUserId
            return conversationRepository.save(existing);
        });
    }

    // Supprimer une conversation
    public boolean deleteConversation(String id) {
        if (conversationRepository.existsById(id)) {
            conversationRepository.deleteById(id);
            return true;
        }
        return false; // ID introuvable
    }
    // Supprimer conversation — uniquement par le SUPERADMIN
    public boolean deleteConversationBySuperAdmin(String conversationId, String userId) {

        // Vérifie que l'utilisateur est bien le SUPERADMIN de cette conversation
        Optional<ConversationParticipant> participant =
                participantRepository.findByConversationIdAndUserId(conversationId, userId);

        if (participant.isEmpty()) return false;

        if (participant.get().getRole() != ConversationParticipant.RoleParticipant.SUPERADMIN) {
            return false; // pas le droit
        }

        // Supprime tous les participants
        List<ConversationParticipant> participants =
                participantRepository.findByConversationId(conversationId);
        participantRepository.deleteAll(participants);

        // Supprime tous les messages
        List<Message> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(conversationId);
        messageRepository.deleteAll(messages);

        // Supprime la conversation
        conversationRepository.deleteById(conversationId);

        return true;
    }


    public List<ConversationDTO> getAllWithLastMessage(String currentUserId) {
        if (currentUserId == null || currentUserId.isBlank()) {
            return List.of();
        }

        List<ConversationParticipant> userParticipants = participantRepository.findByUserId(currentUserId);

        // We still show ALL conversations the user is part of (even if messages are hidden)
        Set<String> userConversationIds = userParticipants.stream()
                .map(ConversationParticipant::getConversationId)
                .collect(Collectors.toSet());

        if (userConversationIds.isEmpty()) {
            return List.of();
        }

        List<Conversation> conversations = conversationRepository.findAllById(userConversationIds);

        return conversations.stream().map(conv -> {
            List<Message> allMessages = messageRepository
                    .findByConversationIdOrderByCreatedAtAsc(conv.getId());

            // Find if this user has hidden messages for this conv
            Optional<ConversationParticipant> participantOpt =
                    participantRepository.findByConversationIdAndUserId(conv.getId(), currentUserId);

            boolean messagesHidden = participantOpt.isPresent() && participantOpt.get().isMessagesHidden();
            LocalDateTime hiddenAt = messagesHidden ? participantOpt.get().getMessagesHiddenAt() : null;

            // Filter visible messages for THIS user
            List<Message> visibleMessages = allMessages.stream()
                    .filter(m -> !m.isDeleted())
                    .filter(m -> {
                        if (!messagesHidden) return true;
                        // If hidden, only show messages created AFTER the hide action
                        return m.getCreatedAt() != null && m.getCreatedAt().isAfter(hiddenAt);
                    })
                    .collect(Collectors.toList());

            // === Last Message (only from visible ones) ===
            String lastContent = null;
            String lastSenderId = null;
            String lastAt = null;

            if (!visibleMessages.isEmpty()) {
                Message last = visibleMessages.get(visibleMessages.size() - 1);
                // Show a human-readable preview instead of raw URLs
                String rawContent = last.getContent();
                Message.TypeMessage type = last.getType();
                if (type == Message.TypeMessage.IMAGE) {
                    lastContent = "someone sent a photo";
                } else if (type == Message.TypeMessage.FILE) {
                    lastContent = "someone sent a file";
                } else {
                    lastContent = rawContent;
                }
                lastSenderId = last.getSenderId();
                lastAt = last.getCreatedAt() != null ? last.getCreatedAt().toString() : null;
            }

            // === Unread Count (only on visible messages) ===
            int unreadCount = 0;
            if (participantOpt.isPresent()) {
                String lastReadId = participantOpt.get().getLastReadMessageId();

                if (lastReadId == null) {
                    unreadCount = (int) visibleMessages.stream()
                            .filter(m -> !m.getSenderId().equals(currentUserId))
                            .count();
                } else {
                    boolean startCounting = false;
                    for (Message m : visibleMessages) {
                        if (m.getId().equals(lastReadId)) {
                            startCounting = true;
                            continue;
                        }
                        if (startCounting && !m.getSenderId().equals(currentUserId)) {
                            unreadCount++;
                        }
                    }
                }
            }

            return new ConversationDTO(conv, lastContent, lastSenderId, lastAt, unreadCount);
        }).collect(Collectors.toList());
    }
    // Créer une conversation privée
    public Conversation createPrivateConversation(String userId1, String userId2) {

        // Vérifie si une conv privée existe déjà entre ces deux utilisateurs
        List<ConversationParticipant> convs1 = participantRepository.findByUserId(userId1);
        List<ConversationParticipant> convs2 = participantRepository.findByUserId(userId2);

        Set<String> ids1 = convs1.stream()
                .map(ConversationParticipant::getConversationId)
                .collect(Collectors.toSet());

        for (ConversationParticipant p : convs2) {
            if (ids1.contains(p.getConversationId())) {
                Optional<Conversation> existing =
                        conversationRepository.findById(p.getConversationId());
                if (existing.isPresent() &&
                        existing.get().getType() == Conversation.TypeConversation.PRIVATE) {
                    return existing.get(); // retourne l'existante
                }
            }
        }

        // Crée la nouvelle conv privée
        Conversation conv = new Conversation(
                userId2 ,          // nom = userId de l'autre
                "Conversation privée",
                Conversation.TypeConversation.PRIVATE,
                userId1
        );
        conv.setCreatedAt(LocalDateTime.now());
        Conversation saved = conversationRepository.save(conv);

        // Ajoute les deux participants sans rôle spécial
        participantRepository.save(new ConversationParticipant(
                saved.getId(), userId1, ConversationParticipant.RoleParticipant.MEMBRE
        ));
        participantRepository.save(new ConversationParticipant(
                saved.getId(), userId2, ConversationParticipant.RoleParticipant.MEMBRE
        ));

        return saved;
    }


    /**
     * Deletes/hides all messages for the current user only (Delete for me)
     */
    public boolean hideMessagesForUser(String conversationId, String userId) {
        Optional<ConversationParticipant> participantOpt =
                participantRepository.findByConversationIdAndUserId(conversationId, userId);

        if (participantOpt.isEmpty()) {
            return false;
        }

        ConversationParticipant participant = participantOpt.get();
        participant.setMessagesHidden(true);
        participantRepository.save(participant);

        return true;
    }
    public Optional<Conversation> updateName(String id, String name) {
        return conversationRepository.findById(id).map(conv -> {
            conv.setNom(name);
            return conversationRepository.save(conv);
        });
    }




    public Optional<Conversation> updatePhotoUrl(String id, String photoUrl) {
        return conversationRepository.findById(id).map(conv -> {
            conv.setPhotoUrl(photoUrl);   // ← just the clean URL, no data:
            return conversationRepository.save(conv);
        });
    }
    /**
     * Mark all visible messages as read for the user by updating lastReadMessageId
     */
    public boolean markAsRead(String conversationId, String userId) {
        Optional<ConversationParticipant> participantOpt =
                participantRepository.findByConversationIdAndUserId(conversationId, userId);

        if (participantOpt.isEmpty()) {
            return false;
        }

        ConversationParticipant participant = participantOpt.get();

        // Get all visible messages for this user (respecting hidden messages)
        List<Message> allMessages = messageRepository
                .findByConversationIdOrderByCreatedAtAsc(conversationId);

        boolean messagesHidden = participant.isMessagesHidden();
        LocalDateTime hiddenAt = messagesHidden ? participant.getMessagesHiddenAt() : null;

        List<Message> visibleMessages = allMessages.stream()
                .filter(m -> !m.isDeleted())
                .filter(m -> {
                    if (!messagesHidden) return true;
                    return m.getCreatedAt() != null && m.getCreatedAt().isAfter(hiddenAt);
                })
                .collect(Collectors.toList());

        // Set lastReadMessageId to the most recent visible message (or null if none)
        String lastReadMessageId = visibleMessages.isEmpty()
                ? null
                : visibleMessages.get(visibleMessages.size() - 1).getId();

        participant.setLastReadMessageId(lastReadMessageId);
        participantRepository.save(participant);

        return true;
    }

}