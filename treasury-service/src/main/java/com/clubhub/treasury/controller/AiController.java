package com.clubhub.treasury.controller;

import com.clubhub.treasury.dto.request.ChatRequest;
import com.clubhub.treasury.dto.response.AnomalyResponse;
import com.clubhub.treasury.dto.response.ChatResponse;
import com.clubhub.treasury.dto.response.PredictionResponse;
import com.clubhub.treasury.security.Roles;
import com.clubhub.treasury.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/ai")
@PreAuthorize(Roles.READ_REPORTS)
public class AiController {

    private final GeminiService geminiService;
    private final AnomalyDetectionService anomalyService;
    private final MlAnomalyDetectionService mlAnomalyService;
    private final PredictionService predictionService;
    private final DashboardService dashboardService;
    private final ExpenseService expenseService;
    private final RagService ragService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public AiController(GeminiService geminiService,
                        AnomalyDetectionService anomalyService,
                        MlAnomalyDetectionService mlAnomalyService,
                        PredictionService predictionService,
                        DashboardService dashboardService,
                        ExpenseService expenseService,
                        RagService ragService) {
        this.geminiService = geminiService;
        this.anomalyService = anomalyService;
        this.mlAnomalyService = mlAnomalyService;
        this.predictionService = predictionService;
        this.dashboardService = dashboardService;
        this.expenseService = expenseService;
        this.ragService = ragService;
    }

    // BF11 - Chatbot Tresorerie IA (RAG)
    @PostMapping("/chat")
    public ResponseEntity<ChatResponse> chat(
            @PathVariable Long clubId,
            @Valid @RequestBody ChatRequest request) {

        // RAG: Retrieval-Augmented Generation
        String reply = ragService.askWithRag(clubId, request.getMessage());
        String source = geminiService.isAvailable() ? "GEMINI_RAG" : "FALLBACK";

        return ResponseEntity.ok(ChatResponse.builder()
                .reply(reply)
                .source(source)
                .build());
    }

    // BF10 - Prediction budgetaire IA
    @GetMapping("/predictions")
    public ResponseEntity<List<PredictionResponse>> predictions(
            @PathVariable Long clubId,
            @RequestParam(defaultValue = "3") int months) {
        return ResponseEntity.ok(predictionService.predict(clubId, months));
    }

    // BF12 - Detection d'anomalies
    @GetMapping("/anomalies")
    public ResponseEntity<List<AnomalyResponse>> anomalies(@PathVariable Long clubId) {
        return ResponseEntity.ok(anomalyService.detectAnomalies(clubId));
    }

    // BF12b - Detection d'anomalies avec modele ML uniquement (Isolation Forest)
    @GetMapping("/anomalies/ml")
    public ResponseEntity<List<AnomalyResponse>> anomaliesMl(@PathVariable Long clubId) {
        return ResponseEntity.ok(mlAnomalyService.detectAnomalies(clubId));
    }

    // Statut du modele ML entraine localement
    @GetMapping("/ml/status")
    public ResponseEntity<Map<String, Object>> mlStatus(@PathVariable Long clubId) {
        return ResponseEntity.ok(mlAnomalyService.getModelStatus());
    }

    // Re-entrainement manuel du modele ML
    @PostMapping("/ml/retrain")
    public ResponseEntity<Map<String, Object>> mlRetrain(@PathVariable Long clubId) {
        mlAnomalyService.trainModel();
        return ResponseEntity.ok(mlAnomalyService.getModelStatus());
    }

    // BF13 - Categorisation auto depenses
    @PostMapping("/categorize")
    public ResponseEntity<Map<String, Object>> categorize(
            @PathVariable Long clubId,
            @RequestBody Map<String, String> request) {

        String title = request.getOrDefault("title", "");
        String description = request.getOrDefault("description", "");

        String response = geminiService.categorizeExpense(title, description);

        try {
            String json = response;
            if (json.contains("{")) {
                json = json.substring(json.indexOf("{"));
                int last = json.lastIndexOf("}");
                json = json.substring(0, last + 1);
            }
            JsonNode node = objectMapper.readTree(json);
            return ResponseEntity.ok(Map.of(
                    "category", node.has("category") ? node.get("category").asText() : "AUTRE",
                    "confidence", node.has("confidence") ? node.get("confidence").asInt() : 50,
                    "reason", node.has("reason") ? node.get("reason").asText() : "Classification automatique",
                    "source", geminiService.isAvailable() ? "GEMINI_AI" : "FALLBACK"
            ));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of(
                    "category", "AUTRE",
                    "confidence", 50,
                    "reason", "Erreur de classification",
                    "source", "ERROR"
            ));
        }
    }

    // Statut IA
    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(@PathVariable Long clubId) {
        return ResponseEntity.ok(Map.of(
                "aiAvailable", true,
                "model", "Treasury IA Engine",
                "features", List.of("chatbot RAG", "categorisation par mots-cles", "regression lineaire", "Random Forest", "Isolation Forest")
        ));
    }
}
