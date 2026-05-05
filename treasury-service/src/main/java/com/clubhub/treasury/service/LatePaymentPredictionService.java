package com.clubhub.treasury.service;

import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.entity.User;
import com.clubhub.treasury.repository.PaymentRepository;
import com.clubhub.treasury.repository.UserRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import smile.classification.RandomForest;
import smile.data.DataFrame;
import smile.data.formula.Formula;
import smile.data.vector.IntVector;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Prediction du risque de retard de paiement via Random Forest (Smile ML).
 *
 * Pourquoi Random Forest plutot qu'Isolation Forest ?
 * - Isolation Forest = UNSUPERVISED (detecte outliers sans labels)
 * - Random Forest = SUPERVISED (apprend de labels PAID_ON_TIME vs LATE)
 * - Pour "Martin va-t-il payer en retard ?", on a des labels clairs -> supervised
 *
 * Features (7 dimensions):
 *   [0] roleOrdinal             - PRESIDENT=0, TRESORIER=1, ..., MEMBRE=6
 *   [1] previousPaymentCount    - nb paiements passes de ce membre
 *   [2] previousLateCount       - nb retards passes
 *   [3] previousLateRate        - ratio retards / total
 *   [4] logAmount               - log(amount)
 *   [5] dueDateDayOfMonth       - jour du mois de l'echeance
 *   [6] daysSincePreviousPayment - delai depuis dernier paiement (-1 si aucun)
 */
@Service
public class LatePaymentPredictionService {

    private static final Logger log = LoggerFactory.getLogger(LatePaymentPredictionService.class);
    private static final int MIN_SAMPLES = 30;
    private static final int MIN_POSITIVE_SAMPLES = 5;  // au moins 5 exemples de LATE

    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;

    private volatile RandomForest model;
    private volatile LocalDateTime lastTrainedAt;
    private volatile int trainedSamples;
    private volatile double accuracy = 0.0;
    private volatile double lateRate = 0.0;

    public LatePaymentPredictionService(PaymentRepository paymentRepository,
                                         UserRepository userRepository) {
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
    }

    @PostConstruct
    public void initOnStartup() {
        try {
            trainModel();
        } catch (Exception e) {
            log.warn("RF training failed at startup: {}", e.getMessage());
        }
    }

    @Scheduled(cron = "0 30 3 * * MON")
    public void scheduledRetrain() {
        log.info("Reentrainement hebdomadaire Random Forest (prediction retards)");
        trainModel();
    }

    public synchronized void trainModel() {
        List<Payment> all = paymentRepository.findAll();
        // Ne garder que les paiements avec un label clair (PAID = on time, LATE = en retard)
        List<Payment> labeled = all.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PAID
                          || p.getStatus() == Payment.PaymentStatus.LATE)
                .sorted(Comparator.comparing(p -> p.getDueDate() != null ? p.getDueDate() : LocalDate.MIN))
                .toList();

        if (labeled.size() < MIN_SAMPLES) {
            log.warn("Pas assez de paiements labelises (min {}, recu {}). Modele RF non entraine.",
                    MIN_SAMPLES, labeled.size());
            this.model = null;
            return;
        }

        int lateCount = (int) labeled.stream().filter(p -> p.getStatus() == Payment.PaymentStatus.LATE).count();
        this.lateRate = (double) lateCount / labeled.size();

        if (lateCount < MIN_POSITIVE_SAMPLES) {
            log.warn("Pas assez d'exemples LATE (min {}, recu {}). RF non entraine.", MIN_POSITIVE_SAMPLES, lateCount);
            this.model = null;
            return;
        }

        // Construire dataset: pour chaque paiement, extraire features + label
        // IMPORTANT: pour eviter le data leakage, les features utilisent uniquement
        // les paiements ANTERIEURS a la dueDate du paiement courant.
        Map<String, User> userMap = new HashMap<>();
        for (User u : userRepository.findAll()) userMap.put(u.getId(), u);

        List<double[]> featureList = new ArrayList<>();
        List<Integer> labelList = new ArrayList<>();

        for (Payment p : labeled) {
            double[] feat = extractHistoricalFeatures(p, labeled, userMap);
            int label = p.getStatus() == Payment.PaymentStatus.LATE ? 1 : 0;
            featureList.add(feat);
            labelList.add(label);
        }

        double[][] X = featureList.toArray(new double[0][]);
        int[] y = labelList.stream().mapToInt(Integer::intValue).toArray();

        // Construire DataFrame Smile (API v4.x: formule + DataFrame)
        DataFrame df = toDataFrame(X, y);
        Formula formula = Formula.lhs("label");

        // Entrainer RF: 100 arbres, mtry=3 (sqrt(7) arrondi), maxDepth 20, maxNodes 100, nodeSize 1
        RandomForest.Options opts = new RandomForest.Options(
                100,                          // ntrees
                Math.min(3, X[0].length),     // mtry (features par split)
                20,                           // maxDepth
                100,                          // maxNodes
                1                             // nodeSize
        );
        this.model = RandomForest.fit(formula, df, opts);
        this.lastTrainedAt = LocalDateTime.now();
        this.trainedSamples = X.length;

        // Accuracy sur training set (pas parfait mais donne une idee)
        int correct = 0;
        for (int i = 0; i < X.length; i++) {
            if (model.predict(df.get(i)) == y[i]) correct++;
        }
        this.accuracy = (double) correct / X.length;

        log.info("Random Forest entraine: {} paiements ({}% LATE), 7 features, training accuracy = {}%",
                X.length,
                String.format("%.1f", lateRate * 100),
                String.format("%.1f", accuracy * 100));
    }

    /** Extrait les features en utilisant UNIQUEMENT les paiements anterieurs (pas de data leakage). */
    private double[] extractHistoricalFeatures(Payment current, List<Payment> allSortedByDueDate, Map<String, User> users) {
        LocalDate cutoff = current.getDueDate() != null ? current.getDueDate() : LocalDate.now();
        String memberId = current.getMemberId();

        // Paiements anterieurs de ce membre
        List<Payment> priorByMember = allSortedByDueDate.stream()
                .filter(p -> Objects.equals(p.getMemberId(), memberId))
                .filter(p -> p.getDueDate() != null && p.getDueDate().isBefore(cutoff))
                .toList();

        int prevCount = priorByMember.size();
        int prevLate = (int) priorByMember.stream().filter(p -> p.getStatus() == Payment.PaymentStatus.LATE).count();
        double prevLateRate = prevCount > 0 ? (double) prevLate / prevCount : lateRate;  // fallback: taux global

        // Delai depuis dernier paiement (si existe)
        double daysSincePrev = -1.0;
        if (!priorByMember.isEmpty()) {
            LocalDate last = priorByMember.get(priorByMember.size() - 1).getDueDate();
            daysSincePrev = ChronoUnit.DAYS.between(last, cutoff);
        }

        // Role du membre
        User member = users.get(memberId);
        double roleOrd = member != null && member.getRole() != null ? member.getRole().ordinal() : -1;

        double logAmount = Math.log1p(current.getAmount() != null ? current.getAmount().doubleValue() : 0);
        double dueDateDay = cutoff.getDayOfMonth();

        return new double[]{roleOrd, prevCount, prevLate, prevLateRate, logAmount, dueDateDay, daysSincePrev};
    }

    /** Predire probabilite de retard pour un nouveau paiement (features au moment du due date). */
    public double predictLateProbability(String memberId, double amount, LocalDate dueDate) {
        if (model == null) return -1.0;

        // Construire "payment fictif" pour extraire features
        Payment fictive = Payment.builder()
                .memberId(memberId)
                .amount(java.math.BigDecimal.valueOf(amount))
                .dueDate(dueDate)
                .status(Payment.PaymentStatus.PENDING)
                .build();

        Map<String, User> userMap = new HashMap<>();
        for (User u : userRepository.findAll()) userMap.put(u.getId(), u);
        List<Payment> history = paymentRepository.findAll().stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PAID
                          || p.getStatus() == Payment.PaymentStatus.LATE)
                .sorted(Comparator.comparing(p -> p.getDueDate() != null ? p.getDueDate() : LocalDate.MIN))
                .toList();

        double[] feat = extractHistoricalFeatures(fictive, history, userMap);

        // Predire proba classe 1 (LATE) via vote des arbres
        // Smile RandomForest expose predict(Tuple) -> int, et posterior(Tuple, double[]) -> probabilities
        DataFrame df = toDataFrame(new double[][]{feat}, new int[]{0});  // label dummy
        double[] proba = new double[2];
        model.predict(df.get(0), proba);
        return proba[1];  // proba classe 1 = LATE
    }

    /** Predire pour TOUS les membres du club (utile pour dashboard "membres a risque"). */
    public List<Map<String, Object>> predictForAllMembers(Long clubId) {
        if (model == null) return List.of();

        List<User> members = userRepository.findAll().stream()
                .filter(u -> Objects.equals(u.getClubId(), clubId))
                .toList();

        List<Map<String, Object>> results = new ArrayList<>();
        LocalDate nextDueDate = LocalDate.now().plusDays(30);

        for (User m : members) {
            // Amount estime: moyenne des paiements passes du membre, ou 120 TND par defaut
            List<Payment> memberPayments = paymentRepository.findByMemberIdAndClubId(m.getId(), clubId);
            double avgAmount = memberPayments.stream()
                    .filter(p -> p.getAmount() != null)
                    .mapToDouble(p -> p.getAmount().doubleValue())
                    .average()
                    .orElse(120.0);

            double proba = predictLateProbability(m.getId(), avgAmount, nextDueDate);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("memberId", m.getId());
            row.put("memberName", (m.getFirstName() == null ? "" : m.getFirstName()) + " " + (m.getLastName() == null ? "" : m.getLastName()));
            row.put("email", m.getEmail());
            row.put("role", m.getRole());
            row.put("lateProbability", Math.round(proba * 1000.0) / 1000.0);
            row.put("riskLevel", riskLevel(proba));
            row.put("previousPayments", memberPayments.size());
            row.put("previousLate", memberPayments.stream().filter(p -> p.getStatus() == Payment.PaymentStatus.LATE).count());
            results.add(row);
        }

        results.sort((a, b) -> Double.compare((double) b.get("lateProbability"), (double) a.get("lateProbability")));
        return results;
    }

    private String riskLevel(double proba) {
        if (proba < 0) return "UNKNOWN";
        if (proba >= 0.7) return "HIGH";
        if (proba >= 0.4) return "MEDIUM";
        return "LOW";
    }

    public Map<String, Object> getModelStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        status.put("trained", model != null);
        status.put("algorithm", "RandomForest (Smile ML 4.3, 100 trees)");
        status.put("trainedAt", lastTrainedAt);
        status.put("trainedSamples", trainedSamples);
        status.put("trainingAccuracy", Math.round(accuracy * 1000.0) / 1000.0);
        status.put("historicalLateRate", Math.round(lateRate * 1000.0) / 1000.0);
        return status;
    }

    /** Helper: convertit double[][] + int[] en DataFrame Smile avec colonne "label". */
    private DataFrame toDataFrame(double[][] X, int[] y) {
        String[] colNames = new String[]{"f0", "f1", "f2", "f3", "f4", "f5", "f6"};
        DataFrame features = DataFrame.of(X, colNames);
        IntVector labelVec = new IntVector("label", y);
        DataFrame labelDf = new DataFrame(labelVec);
        return features.merge(labelDf);
    }
}
