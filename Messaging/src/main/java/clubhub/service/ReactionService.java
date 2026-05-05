package clubhub.service;

import clubhub.model.Reaction;
import clubhub.repository.ReactionRepository;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class ReactionService {

    private final ReactionRepository reactionRepository;

    public ReactionService(ReactionRepository reactionRepository) {
        this.reactionRepository = reactionRepository;
    }

    public List<Reaction> toggleReaction(String messageId, String userId, Reaction.EmojiType emoji) {
        // Look for the exact same reaction (same user + same emoji)
        Optional<Reaction> existing = reactionRepository
                .findByMessageIdAndUserIdAndEmoji(messageId, userId, emoji);

        if (existing.isPresent()) {
            // Same emoji → toggle OFF (remove it)
            reactionRepository.delete(existing.get());
        } else {
            // No exact reaction → add it (this allows only one per emoji, but user can have multiple different emojis)
            // Optional: remove other reactions from same user if you want ONLY ONE reaction per user
            // reactionRepository.deleteByMessageIdAndUserId(messageId, userId);

            reactionRepository.save(new Reaction(messageId, userId, emoji));
        }

        // Always return the full updated list
        return reactionRepository.findByMessageId(messageId);
    }

    public List<Reaction> getReactions(String messageId) {
        return reactionRepository.findByMessageId(messageId);
    }
    public List<Reaction> getReactionsByMessageId(String messageId) {
        return reactionRepository.findByMessageId(messageId);
    }
}