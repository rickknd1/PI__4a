package com.clubhub.treasury.service;

import com.clubhub.treasury.dto.response.AnomalyResponse;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.repository.ExpenseRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import smile.anomaly.IsolationForest;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Anomaly detection via Isolation Forest (Smile ML).
 * Entraine un modele sur les expenses historiques et score chaque nouvelle depense.
 *
 * Pourquoi Isolation Forest plutot que Z-Score ?
 * - Z-Score suppose une distribution gaussienne uni-variee (amount seul)
 * - Isolation Forest: multi-varie, apprend les CORRELATIONS entre features
 *   (ex: un amount de 500 TND est normal en HEBERGEMENT mais anormal en FOURNITURES)
 * - Non parametrique, robuste aux outliers pendant l'entrainement
 */
@Service
public class MlAnomalyDetectionService {

    private static final Logger log = LoggerFactory.getLogger(MlAnomalyDetectionService.class);
    private static final int MIN_SAMPLES_FOR_TRAINING = 30;
    // Contamination: on considere que ~7% des depenses sont anormales dans un club reel
    private static final double CONTAMINATION_RATE = 0.07;
    // Seuil dynamique: anomalie si score > (moyenne + 1.5 * stddev) des scores observes
    private volatile double anomalyThreshold = 0.60;

    private final ExpenseRepository expenseRepository;

    private volatile IsolationForest model;
    private volatile Map<Expense.ExpenseCategory, Double> categoryMeans = new EnumMap<>(Expense.ExpenseCategory.class);
    private volatile LocalDateTime lastTrainedAt;
    private volatile int trainedSampleCount;

    public MlAnomalyDetectionService(ExpenseRepository expenseRepository) {
        this.expenseRepository = expenseRepository;
    }

    @PostConstruct
    public void initOnStartup() {
        try {
            trainModel();
        } catch (Exception e) {
            log.warn("ML training failed at startup (normal si BDD vide): {}", e.getMessage());
        }
    }

    /** Re-entrainement hebdomadaire (tous les lundis 3h du matin). */
    @Scheduled(cron = "0 0 3 * * MON")
    public void scheduledRetrain() {
        log.info("Reentrainement hebdomadaire du modele d'anomalies");
        trainModel();
    }

    /** Entraine le modele sur TOUTES les expenses (Isolation Forest est unsupervised). */
    public synchronized void trainModel() {
        // Isolation Forest = unsupervised: apprend de toutes les donnees (meme les anomalies)
        // mais en excluant les expenses marquees [TEST-ANOMALIE] pour ne pas biaiser la demo
        List<Expense> trainingSet = expenseRepository.findAll().stream()
                .filter(e -> e.getTitle() == null || !e.getTitle().contains("[TEST-ANOMALIE]"))
                .collect(Collectors.toList());

        if (trainingSet.size() < MIN_SAMPLES_FOR_TRAINING) {
            log.warn("Pas assez d'echantillons pour entrainer (min {}, recu {}). Modele non entraine.",
                    MIN_SAMPLES_FOR_TRAINING, trainingSet.size());
            this.model = null;
            return;
        }

        // 1. Calculer moyennes par categorie (feature "deviation from category mean")
        Map<Expense.ExpenseCategory, Double> means = new EnumMap<>(Expense.ExpenseCategory.class);
        Map<Expense.ExpenseCategory, Integer> counts = new EnumMap<>(Expense.ExpenseCategory.class);
        for (Expense e : trainingSet) {
            if (e.getCategory() == null) continue;
            means.merge(e.getCategory(), e.getAmount().doubleValue(), Double::sum);
            counts.merge(e.getCategory(), 1, Integer::sum);
        }
        means.replaceAll((k, v) -> v / counts.get(k));
        this.categoryMeans = means;

        // 2. Construire la matrice de features
        double[][] features = new double[trainingSet.size()][];
        for (int i = 0; i < trainingSet.size(); i++) {
            features[i] = extractFeatures(trainingSet.get(i));
        }

        // 3. Entrainer Isolation Forest
        // Options(numTrees, subsampleSize, contaminationRate, extensionLevel)
        IsolationForest.Options opts = new IsolationForest.Options(200, 256, CONTAMINATION_RATE, 1);
        this.model = IsolationForest.fit(features, opts);
        this.lastTrainedAt = LocalDateTime.now();
        this.trainedSampleCount = trainingSet.size();

        // 4. Calibrer le seuil dynamique: mean + 1.5 * stddev des scores d'entrainement
        double[] trainScores = model.score(features);
        double mean = Arrays.stream(trainScores).average().orElse(0.5);
        double variance = Arrays.stream(trainScores).map(s -> (s - mean) * (s - mean)).average().orElse(0.0);
        double stddev = Math.sqrt(variance);
        this.anomalyThreshold = mean + 1.5 * stddev;

        log.info("Modele Isolation Forest entraine: {} expenses, 200 arbres, 7 features, threshold dynamique = {} (mean={}, stddev={})",
                trainingSet.size(),
                String.format("%.4f", anomalyThreshold),
                String.format("%.4f", mean),
                String.format("%.4f", stddev));
    }

    /**
     * Extrait un vecteur de features d'une expense (7 dimensions).
     * NOTE: testing empirique a montre que memberIdHash et hourOfDay ne sont
     * pas informatifs sur nos donnees et diluent le signal (curse of dimensionality).
     * Seules les features qui correlent avec les anomalies sont gardees.
     *
     *   [0] log(amount + 1)       - echelle log, feature la plus discriminante
     *   [1] categoryOrdinal       - 0..7 (encoded)
     *   [2] dayOfWeek             - 1..7 (pattern temporel)
     *   [3] dayOfMonth            - 1..31
     *   [4] quotesCount           - usually 3, outlier si different
     *   [5] amount / avgByCategory - ratio au comportement moyen (FEATURE CLEF)
     *   [6] daysToValidation      - workflow anormalement rapide/lent (-1 si pas valide)
     */
    private double[] extractFeatures(Expense e) {
        double amount = e.getAmount() != null ? e.getAmount().doubleValue() : 0.0;
        double logAmount = Math.log1p(amount);
        double catOrd = e.getCategory() != null ? e.getCategory().ordinal() : -1;

        LocalDateTime submitted = e.getSubmittedAt() != null ? e.getSubmittedAt() : e.getCreatedAt();
        if (submitted == null) submitted = LocalDateTime.now();
        double dayOfWeek = submitted.getDayOfWeek().getValue();
        double dayOfMonth = submitted.getDayOfMonth();

        double quotesCount = e.getQuotes() != null ? e.getQuotes().size() : 0;

        double avgCat = (e.getCategory() != null && categoryMeans.containsKey(e.getCategory()))
                ? categoryMeans.get(e.getCategory())
                : amount;
        double ratio = avgCat > 0 ? amount / avgCat : 1.0;

        // Delai soumission -> validation (-1 si pas encore valide)
        double daysToValidation = -1.0;
        if (e.getValidatedAt() != null && e.getSubmittedAt() != null) {
            daysToValidation = java.time.Duration.between(e.getSubmittedAt(), e.getValidatedAt()).toHours() / 24.0;
        }

        return new double[]{logAmount, catOrd, dayOfWeek, dayOfMonth, quotesCount, ratio, daysToValidation};
    }

    /** Score d'anomalie pour une expense. 0 = tres normal, > 0.6 = anormal. Retourne -1 si modele non entraine. */
    public double scoreExpense(Expense e) {
        if (model == null) return -1.0;
        return model.score(extractFeatures(e));
    }

    /** Detecte toutes les anomalies pour un club via le modele entraine. */
    public List<AnomalyResponse> detectAnomalies(Long clubId) {
        if (model == null) {
            log.warn("Modele non entraine, detection ML indisponible");
            return List.of();
        }

        List<Expense> expenses = expenseRepository.findByClubIdOrderByCreatedAtDesc(clubId);
        List<AnomalyResponse> anomalies = new ArrayList<>();

        for (Expense e : expenses) {
            double score = model.score(extractFeatures(e));
            if (score > anomalyThreshold) {
                // Confidence proportionnelle a l'ecart au seuil
                int confidence = Math.min(99, (int) (50 + (score - anomalyThreshold) * 400));
                BigDecimal avgCat = BigDecimal.valueOf(categoryMeans.getOrDefault(e.getCategory(), 0.0));

                anomalies.add(AnomalyResponse.builder()
                        .expenseId(e.getId())
                        .type("ML_ISOLATION_FOREST")
                        .description(String.format(
                                "Depense '%s' de %s TND (categorie %s, moyenne historique: %s TND) - Score ML: %.3f",
                                e.getTitle(),
                                e.getAmount(),
                                e.getCategory(),
                                avgCat.setScale(2, java.math.RoundingMode.HALF_UP),
                                score))
                        .confidenceScore(confidence)
                        .zScore(score)
                        .detectedAt(LocalDateTime.now())
                        .build());
            }
        }

        anomalies.sort(Comparator.comparingDouble(AnomalyResponse::getZScore).reversed());
        return anomalies;
    }

    /** Score brut de toutes les expenses du club (pour debug/analyse distribution). */
    public List<Map<String, Object>> scoreAllExpenses(Long clubId) {
        if (model == null) return List.of();
        List<Expense> expenses = expenseRepository.findByClubIdOrderByCreatedAtDesc(clubId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Expense e : expenses) {
            double score = model.score(extractFeatures(e));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", e.getId());
            row.put("title", e.getTitle());
            row.put("amount", e.getAmount());
            row.put("category", e.getCategory());
            row.put("score", score);
            row.put("isAnomaly", score > anomalyThreshold);
            result.add(row);
        }
        result.sort((a, b) -> Double.compare((double) b.get("score"), (double) a.get("score")));
        return result;
    }

    /** Statut du modele (pour endpoint de monitoring). */
    public Map<String, Object> getModelStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("trained", model != null);
        status.put("algorithm", "IsolationForest (Smile ML 4.3)");
        status.put("trainedAt", lastTrainedAt);
        status.put("trainedSamples", trainedSampleCount);
        status.put("anomalyThreshold", anomalyThreshold);
        status.put("contaminationRate", CONTAMINATION_RATE);
        status.put("categoryMeans", categoryMeans);
        status.put("numTrees", model != null ? model.size() : 0);
        return status;
    }
}
