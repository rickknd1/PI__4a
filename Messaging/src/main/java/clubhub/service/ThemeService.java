package clubhub.service;

// ThemeService.java


import clubhub.dto.ConversationThemeEvent;
import clubhub.dto.ThemeGenerationResultDTO;
import clubhub.model.Conversation;
import clubhub.model.Theme;
import clubhub.repository.ConversationRepository;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ThemeService {

    private final ConversationRepository conversationRepository; // Your existing repo
    private final OllamaThemeService ollamaThemeService;
    private final ThemePresetService presetService;
    private final ThemeValidator themeValidator;
    private final SimpMessagingTemplate messagingTemplate;
    private final MongoTemplate mongoTemplate; // Optional, for atomic updates if needed

    public ThemeService(ConversationRepository conversationRepository,
                        OllamaThemeService ollamaThemeService,
                        ThemePresetService presetService,
                        ThemeValidator themeValidator,
                        SimpMessagingTemplate messagingTemplate, MongoTemplate mongoTemplate) {
        this.conversationRepository = conversationRepository;
        this.ollamaThemeService = ollamaThemeService;
        this.presetService = presetService;
        this.themeValidator = themeValidator;
        this.messagingTemplate = messagingTemplate;
        this.mongoTemplate = mongoTemplate;
    }

    public List<Theme> getPresets() {
        return presetService.getPresets();
    }

    /**
     * Generate theme with AI and apply it
     */
    public Theme generateAndApplyTheme(String conversationId, String userId, String prompt) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        validatePermission(conversation, userId);

        ThemeGenerationResultDTO result = ollamaThemeService.generateTheme(prompt);

        Theme themeToApply = result.isSuccess() ? result.getTheme() : presetService.getDefaultTheme();

        return applyThemeInternal(conversation, themeToApply);
    }

    /**
     * Apply a preset or custom theme
     */
    public Theme applyTheme(String conversationId, String userId, Theme theme) {
        Conversation conversation = conversationRepository.findById(conversationId)
                .orElseThrow(() -> new RuntimeException("Conversation not found"));

        validatePermission(conversation, userId);

        if (!themeValidator.isValid(theme)) {
            theme = presetService.getDefaultTheme();
        }

        return applyThemeInternal(conversation, theme);
    }

    private Theme applyThemeInternal(Conversation conversation, Theme theme) {
        conversation.setTheme(theme);
        Conversation saved = conversationRepository.save(conversation);

        // Broadcast real-time update
        broadcastThemeUpdate(conversation.getId(), theme);

        return saved.getTheme();
    }

    private void broadcastThemeUpdate(String conversationId, Theme theme) {
        ConversationThemeEvent event = new ConversationThemeEvent("THEME_UPDATED", theme);
        messagingTemplate.convertAndSend("/topic/conversation/" + conversationId, event);
    }

    /**
     * Permission check - adapt to your existing auth/participant logic
     */
    private void validatePermission(Conversation conversation, String userId) {
        if (conversation.getType() == Conversation.TypeConversation.GROUP) {
            // TODO: Replace with your actual admin check
            // Example: if (!isGroupAdmin(conversation.getId(), userId)) {
            //     throw new AccessDeniedException("Only group admins can change theme");
            // }
            if (!isGroupAdmin(conversation.getId(), userId)) {
                throw new RuntimeException("Only group admins can change the theme");
            }
        } else {
            // PRIVATE conversation
            if (!conversation.getCreatedByUserId().equals(userId) &&
                    !isParticipant(conversation.getId(), userId)) {
                throw new RuntimeException("You do not have permission to change this conversation theme");
            }
        }
    }

    // Placeholder methods - implement based on your existing Participant logic
    private boolean isGroupAdmin(String conversationId, String userId) {
        // Implement using your Participant collection or admin field
        // Return true for now during development
        return true; // ← REPLACE WITH REAL CHECK
    }

    private boolean isParticipant(String conversationId, String userId) {
        // Implement based on your existing logic
        return true; // ← REPLACE WITH REAL CHECK
    }
}