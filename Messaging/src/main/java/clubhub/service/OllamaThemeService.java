package clubhub.service;

import clubhub.dto.OllamaRequestDTO;
import clubhub.dto.OllamaResponseDTO;
import clubhub.dto.ThemeGenerationResultDTO;
import clubhub.model.Theme;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

@Service
public class OllamaThemeService {

    private final WebClient webClient;
    private final ObjectMapper objectMapper;
    private final ThemeValidator themeValidator;
    private final ThemeJsonSanitizer sanitizer;
    private final HuggingFaceImageService imageService;

    @Value("${ollama.model:llama3.2}")
    private String defaultModel;

    private final Theme DEFAULT_FALLBACK = new Theme(
            "Classic Blue", "#0084FF", "#0084FF", "#0084FF",
            "#F0F2F5", false, null, null);  // ← added null for backgroundImageUrl

    public OllamaThemeService(WebClient.Builder webClientBuilder,
                              ObjectMapper objectMapper,
                              ThemeValidator themeValidator,
                              ThemeJsonSanitizer sanitizer,
                              HuggingFaceImageService imageService) {  // ← removed ImageStorageService
        this.webClient = webClientBuilder
                .baseUrl("http://localhost:11434")
                .build();
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
                Theme theme = callOllamaAndParse(prompt, attempt);

                if (themeValidator.isValid(theme)) {
                    // ← URL only, no bytes, no GridFS
                    try {
                        String imageUrl = imageService.generateBackgroundImageUrl(userPrompt);
                        theme.setBackgroundImageUrl(imageUrl);
                    } catch (Exception imgEx) {
                        System.err.println("Image URL generation failed: " + imgEx.getMessage());
                    }
                    return new ThemeGenerationResultDTO(theme, true, "Theme generated successfully");
                }

            } catch (Exception e) {
                System.err.println("Attempt " + attempt + " failed: " + e.getMessage());
            }

            if (attempt < maxAttempts) {
                prompt = buildStrictJsonOnlyPrompt(userPrompt);
            }
        }

        return new ThemeGenerationResultDTO(DEFAULT_FALLBACK, false,
                "AI generation failed. Using default Classic Blue theme.");
    }

    private Theme callOllamaAndParse(String fullPrompt, int attempt) throws JsonProcessingException {
        Map<String, Object> options = new HashMap<>();
        options.put("temperature", attempt == 1 ? 0.7 : 0.3);
        options.put("num_predict", 300);

        OllamaRequestDTO request = new OllamaRequestDTO(
                defaultModel,
                fullPrompt,
                false,
                options
        );

        OllamaResponseDTO ollamaResp = webClient.post()
                .uri("/api/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(request)
                .retrieve()
                .bodyToMono(OllamaResponseDTO.class)
                .timeout(Duration.ofSeconds(45))
                .block();

        if (ollamaResp == null || ollamaResp.getResponse() == null) {
            throw new RuntimeException("Empty response from Ollama");
        }

        String raw = ollamaResp.getResponse();
        String cleanJson = sanitizer.extractCleanJson(raw);

        if (cleanJson == null || cleanJson.trim().isEmpty()) {
            throw new RuntimeException("No valid JSON could be extracted from Ollama response. Raw: " +
                    (raw.length() > 300 ? raw.substring(0, 300) + "..." : raw));
        }

        try {
            JsonNode root = objectMapper.readTree(cleanJson);
            return objectMapper.convertValue(root, Theme.class);
        } catch (Exception e) {
            System.err.println("JSON parsing failed. Cleaned JSON was: " + cleanJson);
            throw e;
        }
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