package clubhub.service;

// NOTE: kept the class name (OllamaThemeService) for binary compat with ThemeService bean
// wiring, but the implementation now calls Groq via Spring AI ChatClient (OpenAI-compatible).
// Why: Ollama requires a local daemon + model pull; Groq Cloud API is faster, free-tier
// generous, and works out of the box once GROQ_API_KEY is set. Better for deployment.

import clubhub.dto.ThemeGenerationResultDTO;
import clubhub.model.Theme;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.stereotype.Service;

@Service
public class OllamaThemeService {

    private static final Logger log = LoggerFactory.getLogger(OllamaThemeService.class);

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private final ThemeValidator themeValidator;
    private final ThemeJsonSanitizer sanitizer;
    private final HuggingFaceImageService imageService;

    private final Theme DEFAULT_FALLBACK = new Theme(
            "Classic Blue", "#0084FF", "#0084FF", "#0084FF",
            "#F0F2F5", false, null, null);

    public OllamaThemeService(OpenAiChatModel chatModel,
                              ObjectMapper objectMapper,
                              ThemeValidator themeValidator,
                              ThemeJsonSanitizer sanitizer,
                              HuggingFaceImageService imageService) {
        this.chatClient = ChatClient.create(chatModel);
        this.objectMapper = objectMapper.copy()
                .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
        this.themeValidator = themeValidator;
        this.sanitizer = sanitizer;
        this.imageService = imageService;
    }

    public ThemeGenerationResultDTO generateTheme(String userPrompt) {
        int maxAttempts = 2;
        String prompt = buildSystemPrompt(userPrompt);

        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                Theme theme = callGroqAndParse(prompt);

                if (themeValidator.isValid(theme)) {
                    try {
                        String imageUrl = imageService.generateBackgroundImageUrl(userPrompt);
                        theme.setBackgroundImageUrl(imageUrl);
                    } catch (Exception imgEx) {
                        log.warn("Image URL generation failed: {}", imgEx.getMessage());
                    }
                    return new ThemeGenerationResultDTO(theme, true, "Theme generated successfully via Groq");
                }
            } catch (Exception e) {
                log.warn("Theme generation attempt {} failed: {}", attempt, e.getMessage());
            }

            if (attempt < maxAttempts) {
                prompt = buildStrictJsonOnlyPrompt(userPrompt);
            }
        }

        return new ThemeGenerationResultDTO(DEFAULT_FALLBACK, false,
                "AI generation failed. Using default Classic Blue theme.");
    }

    private Theme callGroqAndParse(String fullPrompt) throws JsonProcessingException {
        String response = chatClient.prompt()
                .system("You return ONLY valid JSON. No markdown, no commentary.")
                .user(fullPrompt)
                .call()
                .content();

        if (response == null || response.isBlank()) {
            throw new RuntimeException("Empty response from Groq");
        }

        log.debug("Groq raw theme response: {} chars", response.length());

        String cleanJson = sanitizer.extractCleanJson(response);
        if (cleanJson == null || cleanJson.trim().isEmpty()) {
            throw new RuntimeException("No valid JSON could be extracted. Raw: "
                    + (response.length() > 300 ? response.substring(0, 300) + "..." : response));
        }

        JsonNode root = objectMapper.readTree(cleanJson);
        return objectMapper.convertValue(root, Theme.class);
    }

    private String buildSystemPrompt(String userPrompt) {
        return """
                You are an expert chat UI theme designer.
                Create a beautiful, readable theme for a Messenger-like app.

                Return ONLY a valid JSON object with exactly these fields. No extra text, no markdown.

                {
                  "name": "short descriptive name",
                  "primaryColor": "#RRGGBB",
                  "accentColor": "#RRGGBB",
                  "bubbleColor": "#RRGGBB",
                  "backgroundColor": "#RRGGBB",
                  "isGradient": true or false,
                  "gradientEndColor": "#RRGGBB or null"
                }

                User request: %s
                """.formatted(userPrompt);
    }

    private String buildStrictJsonOnlyPrompt(String userPrompt) {
        return """
                Return ONLY valid JSON. No explanations, no markdown, no extra words.
                Strictly follow this exact schema for the chat theme:

                {"name":"","primaryColor":"#RRGGBB","accentColor":"#RRGGBB","bubbleColor":"#RRGGBB","backgroundColor":"#RRGGBB","isGradient":false,"gradientEndColor":null}

                User description: %s
                """.formatted(userPrompt);
    }
}
