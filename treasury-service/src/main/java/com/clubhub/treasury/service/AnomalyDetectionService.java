package com.clubhub.treasury.service;

import com.clubhub.treasury.dto.response.AnomalyResponse;
import com.clubhub.treasury.entity.CotisationRule;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.repository.CotisationRuleRepository;
import com.clubhub.treasury.repository.ExpenseRepository;
import com.clubhub.treasury.repository.PaymentRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnomalyDetectionService {

    private final PaymentRepository paymentRepository;
    private final ExpenseRepository expenseRepository;
    private final CotisationRuleRepository cotisationRuleRepository;
    private final MlAnomalyDetectionService mlService;

    public AnomalyDetectionService(PaymentRepository paymentRepository,
                                    ExpenseRepository expenseRepository,
                                    CotisationRuleRepository cotisationRuleRepository,
                                    MlAnomalyDetectionService mlService) {
        this.paymentRepository = paymentRepository;
        this.expenseRepository = expenseRepository;
        this.cotisationRuleRepository = cotisationRuleRepository;
        this.mlService = mlService;
    }

    public List<AnomalyResponse> detectAnomalies(Long clubId) {
        List<AnomalyResponse> anomalies = new ArrayList<>();

        anomalies.addAll(detectPaymentAnomalies(clubId));

        // Prefer ML (Isolation Forest) for expenses; fallback to Z-Score if model not trained
        List<AnomalyResponse> mlAnomalies = mlService.detectAnomalies(clubId);
        if (!mlAnomalies.isEmpty()) {
            anomalies.addAll(mlAnomalies);
        } else {
            anomalies.addAll(detectExpenseAnomalies(clubId));
        }

        anomalies.addAll(detectDuplicatePayments(clubId));

        anomalies.sort(Comparator.comparingInt(AnomalyResponse::getConfidenceScore).reversed());
        return anomalies;
    }

    /**
     * Detection d'anomalies sur les paiements.
     *
     * Bug-fix: l'ancienne version calculait un Z-Score global qui melangeait
     * cotisations annuelles (120 TND) et mensuelles (15 TND). Les paiements
     * de 120 TND ressortaient comme anomalies alors qu'ils correspondent
     * exactement au montant attendu de la regle annuelle.
     *
     * Nouvelle logique : un paiement est compare au montant de SA propre
     * regle de cotisation. Une anomalie n'est levee que si l'ecart au
     * montant de reference depasse 10% (et n'est pas un paiement echelonne).
     */
    private List<AnomalyResponse> detectPaymentAnomalies(Long clubId) {
        List<Payment> payments = paymentRepository.findByClubIdOrderByCreatedAtDesc(clubId);
        List<AnomalyResponse> anomalies = new ArrayList<>();

        if (payments.isEmpty()) return anomalies;

        // Charger toutes les regles de cotisation du club -> map ruleId -> rule
        Map<String, CotisationRule> ruleMap = cotisationRuleRepository.findByClubId(clubId).stream()
                .collect(Collectors.toMap(CotisationRule::getId, r -> r));

        BigDecimal tolerance = new BigDecimal("0.10"); // 10% de tolerance

        for (Payment p : payments) {
            if (p.getAmount() == null || p.getCotisationRuleId() == null) continue;

            CotisationRule rule = ruleMap.get(p.getCotisationRuleId());
            if (rule == null || rule.getAmount() == null) continue;

            BigDecimal expected = rule.getAmount();
            BigDecimal actual = p.getAmount();

            // Skip paiements echelonnes : montant fractionne legitime
            if (p.getInstallmentNumber() != null && p.getTotalInstallments() != null
                    && p.getTotalInstallments() > 1) {
                continue;
            }

            // Ecart relatif vs montant attendu
            BigDecimal diff = actual.subtract(expected).abs();
            BigDecimal relDiff = diff.divide(expected, 4, RoundingMode.HALF_UP);

            if (relDiff.compareTo(tolerance) > 0) {
                int confidence = Math.min(99, 60 + relDiff.multiply(new BigDecimal("100")).intValue());
                String sign = actual.compareTo(expected) > 0 ? "+" : "-";
                anomalies.add(AnomalyResponse.builder()
                        .paymentId(p.getId())
                        .type("MONTANT_INHABITUEL")
                        .description("Paiement de " + actual + " TND ne correspond pas a la regle '"
                                + rule.getName() + "' (attendu : " + expected + " TND, ecart "
                                + sign + relDiff.multiply(new BigDecimal("100")).setScale(1, RoundingMode.HALF_UP) + "%)")
                        .confidenceScore(confidence)
                        .zScore(relDiff.doubleValue())
                        .detectedAt(LocalDateTime.now())
                        .build());
            }
        }

        return anomalies;
    }

    private List<AnomalyResponse> detectExpenseAnomalies(Long clubId) {
        List<Expense> expenses = expenseRepository.findByClubIdOrderByCreatedAtDesc(clubId);
        List<AnomalyResponse> anomalies = new ArrayList<>();

        if (expenses.size() < 3) return anomalies;

        List<BigDecimal> amounts = expenses.stream()
                .map(Expense::getAmount)
                .collect(Collectors.toList());

        BigDecimal mean = mean(amounts);
        BigDecimal stddev = stddev(amounts, mean);

        if (stddev.compareTo(BigDecimal.ZERO) == 0) return anomalies;

        for (Expense e : expenses) {
            BigDecimal zScore = e.getAmount().subtract(mean)
                    .divide(stddev, 4, RoundingMode.HALF_UP).abs();

            if (zScore.compareTo(new BigDecimal("2.0")) > 0) {
                int confidence = Math.min(99, 50 + zScore.intValue() * 20);
                anomalies.add(AnomalyResponse.builder()
                        .expenseId(e.getId())
                        .type("DEPENSE_ANORMALE")
                        .description("Depense '" + e.getTitle() + "' de " + e.getAmount() + " TND - Z-Score: "
                                + zScore.setScale(2, RoundingMode.HALF_UP) + " (moyenne: " + mean.setScale(2, RoundingMode.HALF_UP) + " TND)")
                        .confidenceScore(confidence)
                        .zScore(zScore.doubleValue())
                        .detectedAt(LocalDateTime.now())
                        .build());
            }
        }

        return anomalies;
    }

    /**
     * Detection de doubles paiements suspects.
     *
     * Bug-fix: l'ancienne version comparait createdAt qui est tres proche
     * pour tous les seeds (cree en rafale), generant des centaines de
     * faux positifs.
     *
     * Nouvelle logique : on compare paidAt (vraie date de paiement) et on
     * ne s'interesse qu'aux paiements PAID (un retard ou un PENDING ne
     * peut pas etre un "double paiement").
     */
    private List<AnomalyResponse> detectDuplicatePayments(Long clubId) {
        List<Payment> payments = paymentRepository.findByClubIdOrderByCreatedAtDesc(clubId).stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PAID)
                .filter(p -> p.getPaidAt() != null)
                .collect(Collectors.toList());

        List<AnomalyResponse> anomalies = new ArrayList<>();

        Map<String, List<Payment>> grouped = payments.stream()
                .collect(Collectors.groupingBy(p -> p.getMemberId() + "-" + p.getAmount()));

        for (Map.Entry<String, List<Payment>> entry : grouped.entrySet()) {
            List<Payment> group = entry.getValue();
            if (group.size() < 2) continue;

            // Trier par paidAt et comparer paires consecutives
            group.sort(Comparator.comparing(Payment::getPaidAt));

            for (int i = 0; i < group.size() - 1; i++) {
                Payment a = group.get(i);
                Payment b = group.get(i + 1);

                long hoursDiff = java.time.Duration.between(a.getPaidAt(), b.getPaidAt()).abs().toHours();
                if (hoursDiff < 24) {
                    anomalies.add(AnomalyResponse.builder()
                            .paymentId(b.getId())
                            .type("DOUBLE_PAIEMENT_SUSPECT")
                            .description("Possible double paiement: membre #" + b.getMemberId()
                                    + " a paye " + b.getAmount() + " TND deux fois en moins de "
                                    + hoursDiff + "h")
                            .confidenceScore(85)
                            .zScore(0)
                            .detectedAt(LocalDateTime.now())
                            .build());
                }
            }
        }

        return anomalies;
    }

    private BigDecimal mean(List<BigDecimal> values) {
        if (values.isEmpty()) return BigDecimal.ZERO;
        BigDecimal sum = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        return sum.divide(new BigDecimal(values.size()), MathContext.DECIMAL64);
    }

    private BigDecimal stddev(List<BigDecimal> values, BigDecimal mean) {
        if (values.size() < 2) return BigDecimal.ONE;
        BigDecimal sumSq = values.stream()
                .map(v -> v.subtract(mean).pow(2))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal variance = sumSq.divide(new BigDecimal(values.size() - 1), MathContext.DECIMAL64);
        return BigDecimal.valueOf(Math.sqrt(variance.doubleValue()));
    }
}
