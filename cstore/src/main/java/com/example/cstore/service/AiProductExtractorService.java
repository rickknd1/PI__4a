package com.example.cstore.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class AiProductExtractorService {

    @Value("${groq.api.key}")
    private String groqApiKey;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public Map<String, Object> extractFromPdf(String pdfText, boolean isTicket) throws Exception {
        // 1. Call Groq to extract structured data
        Map<String, Object> extracted = callGroqForExtraction(pdfText, isTicket);

        // 2. Generate and store image as base64 (only for physical products, not tickets)
        if (!isTicket) {
            String productName = (String) extracted.getOrDefault("name", "");
            String description = (String) extracted.getOrDefault("description", "");
            String imagePrompt = productName + " " + description;
            String imageDataUrl = fetchImageAsBase64(imagePrompt);
            extracted.put("imageUrl", imageDataUrl);
        }

        return extracted;
    }

    private Map<String, Object> callGroqForExtraction(String pdfText, boolean isTicket) throws Exception {
        String prompt;
        if (isTicket) {
            prompt = "Tu es un assistant IA spécialisé dans l'extraction d'informations de billets d'événements.\n"
                    + "À partir du texte suivant, extrait ces champs:\n"
                    + "- name (nom du billet)\n"
                    + "- price (prix en nombre, sans symbole)\n"
                    + "- eventName (nom de l'événement)\n"
                    + "- eventDate (format ISO: YYYY-MM-DDTHH:MM:SS)\n"
                    + "- venue (lieu)\n"
                    + "- availableTickets (nombre de places, entier)\n"
                    + "- description (courte description, max 2 phrases, enthousiaste)\n"
                    + "Retourne UNIQUEMENT un objet JSON valide avec ces clés, rien d'autre.\n\n"
                    + "Texte: " + pdfText;
        } else {
            prompt = "Tu es un rédacteur publicitaire expert pour des clubs associatifs.\n"
                    + "À partir du texte suivant, extrais ces champs:\n"
                    + "- name (nom du produit)\n"
                    + "- price (prix en nombre, sans symbole)\n"
                    + "- productType (doit être: JERSEY, TSHIRT, HAT, SCARF, ACCESSORY, CERTIFICATE)\n"
                    + "- size (taille, ex: S, M, L, XL)\n"
                    + "- color (couleur)\n"
                    + "- stockQuantity (entier)\n"
                    + "- description (courte description marketing, 2-3 phrases, attractive, avec urgence si stock < 10)\n"
                    + "- isAvailable (booléen, true si stock > 0)\n"
                    + "Retourne UNIQUEMENT un objet JSON valide avec ces clés.\n\n"
                    + "Texte: " + pdfText;
        }

        // Prepare HTTP request to Groq
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Authorization", "Bearer " + groqApiKey);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", "llama-3.3-70b-versatile");
        requestBody.put("messages", new Object[]{Map.of("role", "user", "content", prompt)});
        requestBody.put("temperature", 0.2);
        requestBody.put("response_format", Map.of("type", "json_object"));

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
        String groqUrl = "https://api.groq.com/openai/v1/chat/completions";

        ResponseEntity<String> response = restTemplate.postForEntity(groqUrl, entity, String.class);

        JsonNode root = objectMapper.readTree(response.getBody());
        String jsonContent = root.path("choices").get(0).path("message").path("content").asText();
        jsonContent = jsonContent.replace("```json", "").replace("```", "").trim();

        return objectMapper.readValue(jsonContent, Map.class);
    }

    private String fetchImageAsBase64(String prompt) {
        try {
            // Build the Pollinations.ai URL
            String encodedPrompt = URLEncoder.encode(prompt, StandardCharsets.UTF_8.toString());
            String imageUrl = "https://image.pollinations.ai/prompt/" + encodedPrompt;

            // Download the image as byte array
            byte[] imageBytes = restTemplate.getForObject(imageUrl, byte[].class);

            if (imageBytes != null && imageBytes.length > 1000) {
                // Encode to base64 and return as data URL
                String base64 = Base64.getEncoder().encodeToString(imageBytes);
                return "data:image/jpeg;base64," + base64;
            } else {
                // Fallback: a generic placeholder image (base64 encoded transparent PNG)
                return "https://placehold.co/400x300/1e3a8a/white?text=Product";
            }
        } catch (Exception e) {
            e.printStackTrace();
            // Final fallback: a simple data URL with a text placeholder
            return "https://placehold.co/400x300/1e3a8a/white?text=Product";
        }
    }
}