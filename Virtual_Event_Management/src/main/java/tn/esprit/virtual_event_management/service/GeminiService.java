package tn.esprit.virtual_event_management.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

@Service
public class GeminiService {
    private final WebClient.Builder webClientBuilder;
    private final String apiKey;

    private final String MODEL_URL =
            "https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent";

    public GeminiService(
            WebClient.Builder webClientBuilder,
            @Value("${gemini.api.key}") String apiKey
    ) {
        this.webClientBuilder = webClientBuilder;
        this.apiKey = apiKey;
    }

    public String extractEvent(String prompt) {

        WebClient client = webClientBuilder.build();

        try {
            Map<String, Object> body = Map.of(
                    "contents", List.of(
                            Map.of(
                                    "parts", List.of(
                                            Map.of("text", prompt)
                                    )
                            )
                    )
            );

            Map response = client.post()
                    .uri(MODEL_URL + "?key=" + apiKey)
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            return extractText(response);

        } catch (Exception e) {
            return "Gemini error: " + e.getMessage();
        }
    }

    private String extractText(Map response) {
        if (response == null || !response.containsKey("candidates")) {
            return "No response";
        }

        var candidates = (List<Map<String, Object>>) response.get("candidates");
        var content = (Map<String, Object>) candidates.get(0).get("content");
        var parts = (List<Map<String, Object>>) content.get("parts");

        return parts.get(0).get("text").toString();
    }
}
