package com.clubhub.treasury.service;

import com.clubhub.treasury.dto.response.PredictionResponse;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.repository.ExpenseRepository;
import com.clubhub.treasury.repository.PaymentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PredictionService {

    private static final Logger log = LoggerFactory.getLogger(PredictionService.class);

    private final PaymentRepository paymentRepository;
    private final ExpenseRepository expenseRepository;
    private final GeminiService geminiService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public PredictionService(PaymentRepository paymentRepository,
                              ExpenseRepository expenseRepository,
                              GeminiService geminiService) {
        this.paymentRepository = paymentRepository;
        this.expenseRepository = expenseRepository;
        this.geminiService = geminiService;
    }

    public List<PredictionResponse> predict(String clubId, int monthsAhead) {
        // Collect historical data (last 6 months)
        List<Payment> payments = paymentRepository.findByClubIdOrderByCreatedAtDesc(clubId);
        List<Expense> expenses = expenseRepository.findByClubIdOrderByCreatedAtDesc(clubId);

        Map<String, BigDecimal> monthlyRevenue = new LinkedHashMap<>();
        Map<String, BigDecimal> monthlyExpenses = new LinkedHashMap<>();

        YearMonth now = YearMonth.now();
        for (int i = 5; i >= 0; i--) {
            YearMonth ym = now.minusMonths(i);
            String key = ym.format(DateTimeFormatter.ofPattern("yyyy-MM"));
            monthlyRevenue.put(key, BigDecimal.ZERO);
            monthlyExpenses.put(key, BigDecimal.ZERO);
        }

        for (Payment p : payments) {
            if (p.getPaidAt() != null && "PAID".equals(p.getStatus().name())) {
                String key = YearMonth.from(p.getPaidAt()).format(DateTimeFormatter.ofPattern("yyyy-MM"));
                monthlyRevenue.computeIfPresent(key, (k, v) -> v.add(p.getAmount()));
            }
        }

        for (Expense e : expenses) {
            if ("APPROVED".equals(e.getStatus().name()) && e.getApprovedAt() != null) {
                String key = YearMonth.from(e.getApprovedAt()).format(DateTimeFormatter.ofPattern("yyyy-MM"));
                monthlyExpenses.computeIfPresent(key, (k, v) -> v.add(e.getAmount()));
            }
        }

        // Try Gemini for smart predictions
        if (geminiService.isAvailable()) {
            try {
                return predictWithGemini(monthlyRevenue, monthlyExpenses, monthsAhead);
            } catch (Exception e) {
                log.warn("Gemini prediction failed, falling back to linear regression: {}", e.getMessage());
            }
        }

        // Fallback: simple linear regression
        return predictLinear(monthlyRevenue, monthlyExpenses, monthsAhead);
    }

    private List<PredictionResponse> predictWithGemini(Map<String, BigDecimal> revenue,
                                                         Map<String, BigDecimal> expenses,
                                                         int monthsAhead) {
        StringBuilder context = new StringBuilder();
        context.append("Revenus mensuels (TND):\n");
        revenue.forEach((k, v) -> context.append("  ").append(k).append(": ").append(v).append("\n"));
        context.append("Depenses mensuels (TND):\n");
        expenses.forEach((k, v) -> context.append("  ").append(k).append(": ").append(v).append("\n"));

        String response = geminiService.analyzeBudgetTrend(context.toString());

        try {
            // Clean response - extract JSON
            String json = response;
            if (json.contains("```json")) {
                json = json.substring(json.indexOf("```json") + 7);
                json = json.substring(0, json.indexOf("```"));
            } else if (json.contains("{")) {
                json = json.substring(json.indexOf("{"));
                int lastBrace = json.lastIndexOf("}");
                json = json.substring(0, lastBrace + 1);
            }

            JsonNode root = objectMapper.readTree(json);
            JsonNode predictions = root.get("predictions");
            List<String> alerts = new ArrayList<>();
            if (root.has("alerts")) {
                root.get("alerts").forEach(n -> alerts.add(n.asText()));
            }

            List<PredictionResponse> result = new ArrayList<>();
            if (predictions != null && predictions.isArray()) {
                for (JsonNode pred : predictions) {
                    result.add(PredictionResponse.builder()
                            .period(pred.get("month").asText())
                            .predictedRevenue(new BigDecimal(pred.get("predictedRevenue").asText()))
                            .predictedExpenses(new BigDecimal(pred.get("predictedExpenses").asText()))
                            .predictedBalance(new BigDecimal(pred.has("balance") ? pred.get("balance").asText() : "0"))
                            .confidence(pred.get("confidence").asInt(70))
                            .trend(pred.has("trend") ? pred.get("trend").asText() : "STABLE")
                            .alerts(alerts)
                            .source("GEMINI_AI")
                            .build());
                }
            }
            return result;

        } catch (Exception e) {
            log.warn("Failed to parse Gemini prediction: {}", e.getMessage());
            return predictLinear(revenue, expenses, monthsAhead);
        }
    }

    private List<PredictionResponse> predictLinear(Map<String, BigDecimal> revenue,
                                                     Map<String, BigDecimal> expenses,
                                                     int monthsAhead) {
        List<BigDecimal> revValues = new ArrayList<>(revenue.values());
        List<BigDecimal> expValues = new ArrayList<>(expenses.values());

        double revSlope = linearSlope(revValues);
        double expSlope = linearSlope(expValues);

        // Baseline robuste : si le dernier mois est trop faible (mois en cours
        // probablement incomplet), on utilise la moyenne des 5 mois precedents.
        // Sinon les predictions partiraient de 0 et resteraient a 0.
        double revLast = baseline(revValues);
        double expLast = baseline(expValues);

        List<PredictionResponse> predictions = new ArrayList<>();
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRENCH);

        for (int i = 1; i <= monthsAhead; i++) {
            YearMonth ym = YearMonth.now().plusMonths(i);
            double predRev = Math.max(0, revLast + revSlope * i);
            double predExp = Math.max(0, expLast + expSlope * i);
            double balance = predRev - predExp;
            int confidence = Math.max(30, 80 - (i * 10));

            String trend;
            if (balance > predRev * 0.1) trend = "UP";
            else if (balance < -predRev * 0.1) trend = "DOWN";
            else trend = "STABLE";

            List<String> alerts = new ArrayList<>();
            if (balance < 0) {
                alerts.add("Deficit prevu de " + BigDecimal.valueOf(Math.abs(balance)).setScale(2, RoundingMode.HALF_UP) + " TND en " + ym.format(fmt));
            }

            predictions.add(PredictionResponse.builder()
                    .period(ym.format(fmt))
                    .predictedRevenue(BigDecimal.valueOf(predRev).setScale(2, RoundingMode.HALF_UP))
                    .predictedExpenses(BigDecimal.valueOf(predExp).setScale(2, RoundingMode.HALF_UP))
                    .predictedBalance(BigDecimal.valueOf(balance).setScale(2, RoundingMode.HALF_UP))
                    .confidence(confidence)
                    .trend(trend)
                    .alerts(alerts)
                    .source("LINEAR_REGRESSION")
                    .build());
        }

        return predictions;
    }

    /**
     * Baseline pour la projection : utilise le dernier mois sauf s'il est
     * anormalement bas (= mois en cours probablement incomplet), auquel cas
     * on retombe sur la moyenne des mois precedents non-nuls.
     */
    private double baseline(List<BigDecimal> values) {
        if (values.isEmpty()) return 0;
        double last = values.get(values.size() - 1).doubleValue();
        if (values.size() < 2) return last;
        // Moyenne des mois precedents (excluant le mois en cours)
        List<Double> history = values.subList(0, values.size() - 1).stream()
                .map(BigDecimal::doubleValue)
                .filter(v -> v > 0)
                .toList();
        if (history.isEmpty()) return last;
        double avg = history.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        // Si le dernier mois est < 30% de la moyenne historique, on bascule sur la moyenne
        return (last < avg * 0.3) ? avg : last;
    }

    private double linearSlope(List<BigDecimal> values) {
        if (values.size() < 2) return 0;
        int n = values.size();
        double sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (int i = 0; i < n; i++) {
            double x = i;
            double y = values.get(i).doubleValue();
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        }
        double denom = n * sumX2 - sumX * sumX;
        if (denom == 0) return 0;
        return (n * sumXY - sumX * sumY) / denom;
    }
}
