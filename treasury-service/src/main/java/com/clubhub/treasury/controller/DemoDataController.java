package com.clubhub.treasury.controller;

import com.clubhub.treasury.entity.*;
import com.clubhub.treasury.repository.*;
import com.clubhub.treasury.service.AnomalyDetectionService;
import com.clubhub.treasury.service.LatePaymentPredictionService;
import com.clubhub.treasury.service.MlAnomalyDetectionService;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

@RestController
@RequestMapping("/api/v1/demo")
public class DemoDataController {

    private final CotisationRuleRepository cotisationRuleRepo;
    private final PaymentRepository paymentRepo;
    private final ExpenseRepository expenseRepo;
    private final BudgetRepository budgetRepo;
    private final AuditLogRepository auditLogRepo;
    private final UserRepository userRepo;
    private final MlAnomalyDetectionService mlAnomalyService;
    private final LatePaymentPredictionService latePaymentPredictor;
    private final AnomalyDetectionService anomalyService;

    public DemoDataController(CotisationRuleRepository cotisationRuleRepo,
                               PaymentRepository paymentRepo,
                               ExpenseRepository expenseRepo,
                               BudgetRepository budgetRepo,
                               AuditLogRepository auditLogRepo,
                               UserRepository userRepo,
                               MlAnomalyDetectionService mlAnomalyService,
                               LatePaymentPredictionService latePaymentPredictor,
                               AnomalyDetectionService anomalyService) {
        this.cotisationRuleRepo = cotisationRuleRepo;
        this.paymentRepo = paymentRepo;
        this.expenseRepo = expenseRepo;
        this.budgetRepo = budgetRepo;
        this.auditLogRepo = auditLogRepo;
        this.userRepo = userRepo;
        this.mlAnomalyService = mlAnomalyService;
        this.latePaymentPredictor = latePaymentPredictor;
        this.anomalyService = anomalyService;
    }

    @PostMapping("/seed")
    @Transactional
    public ResponseEntity<Map<String, Object>> seed() {
        // Vider les collections avant de reseed (evite les doublons)
        userRepo.deleteAll();
        cotisationRuleRepo.deleteAll();
        paymentRepo.deleteAll();
        expenseRepo.deleteAll();
        budgetRepo.deleteAll();
        auditLogRepo.deleteAll();

        // Users en BDD (MongoDB generates String IDs)
        User president = userRepo.save(User.builder().email("ali.bensalah@esprit.tn").firstName("Ali").lastName("Ben Salah").role(User.UserRole.PRESIDENT).clubId("1").build());
        User tresorier = userRepo.save(User.builder().email("fatma.haddad@esprit.tn").firstName("Fatma").lastName("Haddad").role(User.UserRole.TRESORIER).clubId("1").build());
        User bureau = userRepo.save(User.builder().email("hedi.saidi@esprit.tn").firstName("Hedi").lastName("Saidi").role(User.UserRole.MEMBRE_BUREAU).clubId("1").build());
        User sana = userRepo.save(User.builder().email("sana.khelifi@esprit.tn").firstName("Sana").lastName("Khelifi").role(User.UserRole.MEMBRE).clubId("1").build());
        User omar = userRepo.save(User.builder().email("omar.mansouri@esprit.tn").firstName("Omar").lastName("Mansouri").role(User.UserRole.MEMBRE).clubId("1").build());
        User nour = userRepo.save(User.builder().email("nour.triki@esprit.tn").firstName("Nour").lastName("Triki").role(User.UserRole.MEMBRE).clubId("1").build());
        User yassine = userRepo.save(User.builder().email("yassine.bouazizi@esprit.tn").firstName("Yassine").lastName("Bouazizi").role(User.UserRole.MEMBRE).clubId("1").build());
        User amira = userRepo.save(User.builder().email("amira.gharbi@esprit.tn").firstName("Amira").lastName("Gharbi").role(User.UserRole.MEMBRE).clubId("1").build());
        // ID force pour matcher l'ID user-service (sinon le JWT de Dylan ne pointe sur aucun user Treasury)
        User dylan = userRepo.save(User.builder().id("69dbc2ce1983a953cd948382").email("kayzeurdylan2@gmail.com").firstName("Dylan").lastName("Kayzeur").role(User.UserRole.MEMBRE).clubId("1").build());

        // Cotisation rules
        CotisationRule annual = cotisationRuleRepo.save(CotisationRule.builder()
                .clubId("1").name("Cotisation annuelle 2025/2026").amount(new BigDecimal("120.000"))
                .frequency(CotisationRule.Frequency.ANNUAL).startDate(LocalDate.of(2025, 9, 1))
                .endDate(LocalDate.of(2026, 8, 31)).active(true)
                .allowExemption(false).allowInstallments(true).maxInstallments(3).build());

        CotisationRule monthly = cotisationRuleRepo.save(CotisationRule.builder()
                .clubId("1").name("Cotisation mensuelle activites").amount(new BigDecimal("15.000"))
                .frequency(CotisationRule.Frequency.MONTHLY).startDate(LocalDate.of(2025, 10, 1))
                .active(true).allowExemption(true).allowInstallments(false).build());

        // Payments - use actual MongoDB user IDs as memberId
        // Paid payments (with dates spread across months for dashboard chart)
        paymentRepo.save(Payment.builder().memberId(president.getId()).clubId("1").cotisationRuleId(annual.getId()).amount(new BigDecimal("120.000"))
                .status(Payment.PaymentStatus.PAID).dueDate(LocalDate.of(2025, 10, 1))
                .paidAt(LocalDateTime.of(2025, 10, 3, 10, 30)).build());
        paymentRepo.save(Payment.builder().memberId(tresorier.getId()).clubId("1").cotisationRuleId(monthly.getId()).amount(new BigDecimal("15.000"))
                .status(Payment.PaymentStatus.PAID).dueDate(LocalDate.of(2025, 11, 1))
                .paidAt(LocalDateTime.of(2025, 11, 2, 9, 0)).build());
        paymentRepo.save(Payment.builder().memberId(bureau.getId()).clubId("1").cotisationRuleId(annual.getId()).amount(new BigDecimal("120.000"))
                .status(Payment.PaymentStatus.PAID).dueDate(LocalDate.of(2025, 11, 1))
                .paidAt(LocalDateTime.of(2025, 11, 5, 14, 0)).build());
        paymentRepo.save(Payment.builder().memberId(nour.getId()).clubId("1").cotisationRuleId(annual.getId()).amount(new BigDecimal("120.000"))
                .status(Payment.PaymentStatus.PAID).dueDate(LocalDate.of(2025, 12, 1))
                .paidAt(LocalDateTime.of(2025, 12, 3, 9, 0)).build());
        paymentRepo.save(Payment.builder().memberId(yassine.getId()).clubId("1").cotisationRuleId(monthly.getId()).amount(new BigDecimal("15.000"))
                .status(Payment.PaymentStatus.PAID).dueDate(LocalDate.of(2026, 1, 1))
                .paidAt(LocalDateTime.of(2026, 1, 2, 11, 0)).build());
        paymentRepo.save(Payment.builder().memberId(president.getId()).clubId("1").cotisationRuleId(monthly.getId()).amount(new BigDecimal("15.000"))
                .status(Payment.PaymentStatus.PAID).dueDate(LocalDate.of(2026, 2, 1))
                .paidAt(LocalDateTime.of(2026, 2, 3, 10, 0)).build());
        paymentRepo.save(Payment.builder().memberId(amira.getId()).clubId("1").cotisationRuleId(annual.getId()).amount(new BigDecimal("120.000"))
                .status(Payment.PaymentStatus.PAID).dueDate(LocalDate.of(2026, 2, 1))
                .paidAt(LocalDateTime.of(2026, 2, 5, 15, 0)).build());
        paymentRepo.save(Payment.builder().memberId(tresorier.getId()).clubId("1").cotisationRuleId(monthly.getId()).amount(new BigDecimal("15.000"))
                .status(Payment.PaymentStatus.PAID).dueDate(LocalDate.of(2026, 3, 1))
                .paidAt(LocalDateTime.of(2026, 3, 2, 9, 0)).build());

        // Pending/Late payments
        paymentRepo.save(Payment.builder().memberId(sana.getId()).clubId("1").cotisationRuleId(annual.getId()).amount(new BigDecimal("120.000"))
                .status(Payment.PaymentStatus.PENDING).dueDate(LocalDate.of(2026, 4, 15)).build());
        paymentRepo.save(Payment.builder().memberId(omar.getId()).clubId("1").cotisationRuleId(annual.getId()).amount(new BigDecimal("120.000"))
                .status(Payment.PaymentStatus.LATE).dueDate(LocalDate.of(2026, 1, 1)).build());
        paymentRepo.save(Payment.builder().memberId(yassine.getId()).clubId("1").cotisationRuleId(annual.getId()).amount(new BigDecimal("120.000"))
                .status(Payment.PaymentStatus.LATE).dueDate(LocalDate.of(2026, 2, 1)).build());

        // Dylan (kayzeurdylan2) - 3 cotisations en retard
        paymentRepo.save(Payment.builder().memberId(dylan.getId()).clubId("1").cotisationRuleId(monthly.getId()).amount(new BigDecimal("15.000"))
                .status(Payment.PaymentStatus.LATE).dueDate(LocalDate.of(2026, 1, 1)).build());
        paymentRepo.save(Payment.builder().memberId(dylan.getId()).clubId("1").cotisationRuleId(monthly.getId()).amount(new BigDecimal("15.000"))
                .status(Payment.PaymentStatus.LATE).dueDate(LocalDate.of(2026, 2, 1)).build());
        paymentRepo.save(Payment.builder().memberId(dylan.getId()).clubId("1").cotisationRuleId(annual.getId()).amount(new BigDecimal("120.000"))
                .status(Payment.PaymentStatus.LATE).dueDate(LocalDate.of(2026, 3, 1)).build());

        // Refunded
        paymentRepo.save(Payment.builder().memberId(nour.getId()).clubId("1").cotisationRuleId(monthly.getId()).amount(new BigDecimal("15.000"))
                .status(Payment.PaymentStatus.REFUNDED).dueDate(LocalDate.of(2025, 12, 1))
                .paidAt(LocalDateTime.of(2025, 12, 3, 9, 0)).build());

        // Exempt
        paymentRepo.save(Payment.builder().memberId(bureau.getId()).clubId("1").cotisationRuleId(monthly.getId()).amount(new BigDecimal("15.000"))
                .status(Payment.PaymentStatus.EXEMPT).dueDate(LocalDate.of(2026, 3, 1)).build());

        // Expenses - all workflow statuses (avec 3 devis chacune pour demo)
        expenseRepo.save(Expense.builder().clubId("1").submittedByMemberId(president.getId()).title("Materiel evenement")
                .description("Tables et chaises pour journee portes ouvertes").amount(new BigDecimal("320.000"))
                .status(Expense.ExpenseStatus.SUBMITTED).category(Expense.ExpenseCategory.MATERIEL)
                .categoryConfidenceScore(87)
                .quotes(List.of(
                        Expense.Quote.builder().providerName("Meuble Plus SARL").amount(new BigDecimal("320.000")).description("20 tables + 80 chaises, livraison incluse").selected(false).build(),
                        Expense.Quote.builder().providerName("Equip'Event Tunis").amount(new BigDecimal("295.000")).description("15 tables + 60 chaises, sans livraison").selected(false).build(),
                        Expense.Quote.builder().providerName("Location Pro").amount(new BigDecimal("350.000")).description("25 tables + 100 chaises, montage inclus").selected(false).build()
                ))
                .build());
        expenseRepo.save(Expense.builder().clubId("1").submittedByMemberId(sana.getId()).title("Transport deplacement")
                .description("Location bus pour competition inter-universitaire").amount(new BigDecimal("180.000"))
                .status(Expense.ExpenseStatus.VALIDATED).validatedByTreasurerId(tresorier.getId())
                .category(Expense.ExpenseCategory.TRANSPORT).categoryConfidenceScore(94)
                .validatedAt(LocalDateTime.now().minusDays(2))
                .quotes(List.of(
                        Expense.Quote.builder().providerName("Transport Tunisien").amount(new BigDecimal("200.000")).description("Bus 50 places, chauffeur inclus").selected(false).build(),
                        Expense.Quote.builder().providerName("Bus Express").amount(new BigDecimal("180.000")).description("Bus 45 places, chauffeur inclus").selected(true).build(),
                        Expense.Quote.builder().providerName("Royal Bus").amount(new BigDecimal("220.000")).description("Bus VIP 40 places, service premium").selected(false).build()
                ))
                .build());
        expenseRepo.save(Expense.builder().clubId("1").submittedByMemberId(omar.getId()).title("Restauration reunion")
                .description("Buffet reunion mensuelle du bureau").amount(new BigDecimal("95.000"))
                .status(Expense.ExpenseStatus.APPROVED).validatedByTreasurerId(tresorier.getId()).approvedByPresidentId(president.getId())
                .category(Expense.ExpenseCategory.RESTAURATION).categoryConfidenceScore(91)
                .categoryValidatedByTreasurer(true)
                .validatedAt(LocalDateTime.now().minusDays(5)).approvedAt(LocalDateTime.now().minusDays(3))
                .quotes(List.of(
                        Expense.Quote.builder().providerName("Traiteur Gourmet").amount(new BigDecimal("95.000")).description("Buffet 15 personnes, 3 plats").selected(true).build(),
                        Expense.Quote.builder().providerName("Chef a domicile").amount(new BigDecimal("110.000")).description("Buffet 15 personnes, 4 plats").selected(false).build(),
                        Expense.Quote.builder().providerName("Delices Tunisiens").amount(new BigDecimal("120.000")).description("Buffet 20 personnes, 3 plats + dessert").selected(false).build()
                ))
                .build());
        expenseRepo.save(Expense.builder().clubId("1").submittedByMemberId(bureau.getId()).title("Impression flyers")
                .description("500 flyers evenement de bienvenue").amount(new BigDecimal("45.000"))
                .status(Expense.ExpenseStatus.REJECTED).rejectionReason("Budget communication depasse")
                .category(Expense.ExpenseCategory.COMMUNICATION).categoryConfidenceScore(96)
                .quotes(List.of(
                        Expense.Quote.builder().providerName("ImprimExpress").amount(new BigDecimal("45.000")).description("500 flyers A5 couleur").selected(false).build(),
                        Expense.Quote.builder().providerName("PrintMax").amount(new BigDecimal("55.000")).description("500 flyers A5 couleur papier glace").selected(false).build(),
                        Expense.Quote.builder().providerName("Flyers Pro").amount(new BigDecimal("40.000")).description("500 flyers A5 couleur standard").selected(false).build()
                ))
                .build());
        expenseRepo.save(Expense.builder().clubId("1").submittedByMemberId(yassine.getId()).title("Hebergement conference")
                .description("2 nuits hotel pour 3 membres - conference nationale").amount(new BigDecimal("450.000"))
                .status(Expense.ExpenseStatus.SUBMITTED).category(Expense.ExpenseCategory.HEBERGEMENT)
                .categoryConfidenceScore(89)
                .quotes(List.of(
                        Expense.Quote.builder().providerName("Hotel Royal").amount(new BigDecimal("450.000")).description("3 chambres doubles, 2 nuits, petit-dejeuner").selected(false).build(),
                        Expense.Quote.builder().providerName("Ibis Tunis").amount(new BigDecimal("380.000")).description("3 chambres doubles, 2 nuits, sans petit-dejeuner").selected(false).build(),
                        Expense.Quote.builder().providerName("Hotel Business").amount(new BigDecimal("500.000")).description("3 chambres premium, 2 nuits, all-inclusive").selected(false).build()
                ))
                .build());

        // ===== GENERATION MASSIVE POUR ENTRAINEMENT ML =====
        // 145 expenses + 7 anomalies pour Isolation Forest
        List<User> allMembers = List.of(president, tresorier, bureau, sana, omar, nour, yassine, amira, dylan);
        generateBulkExpenses(allMembers, tresorier, president, 145);
        injectVolontaryAnomalies(allMembers, tresorier, president);

        // 180 paiements historiques avec patterns de retard par membre (pour Random Forest)
        generateBulkPayments(allMembers, annual, monthly);

        // Budgets
        budgetRepo.save(Budget.builder().clubId("1").label("Budget annuel 2025/2026")
                .totalAmount(new BigDecimal("5000.000")).consumedAmount(new BigDecimal("3100.000"))
                .periodStart(LocalDate.of(2025, 9, 1)).periodEnd(LocalDate.of(2026, 8, 31))
                .alert50Sent(true).alert75Sent(false).alert90Sent(false).alert100Sent(false).build());
        budgetRepo.save(Budget.builder().clubId("1").label("Budget evenements S2")
                .totalAmount(new BigDecimal("1500.000")).consumedAmount(new BigDecimal("1380.000"))
                .periodStart(LocalDate.of(2026, 2, 1)).periodEnd(LocalDate.of(2026, 6, 30))
                .alert50Sent(true).alert75Sent(true).alert90Sent(true).alert100Sent(false).build());
        budgetRepo.save(Budget.builder().clubId("1").label("Budget communication")
                .totalAmount(new BigDecimal("800.000")).consumedAmount(new BigDecimal("350.000"))
                .periodStart(LocalDate.of(2025, 9, 1)).periodEnd(LocalDate.of(2026, 8, 31))
                .alert50Sent(false).alert75Sent(false).alert90Sent(false).alert100Sent(false).build());

        // Audit logs (actorId and entityId are now String)
        auditLogRepo.save(AuditLog.builder().actorId(tresorier.getId()).actorEmail("tresorier@clubhub.tn").clubId("1")
                .action(AuditLog.ActionType.PAYMENT_CREATED).entityType("Payment").entityId("seed-payment-1")
                .valuesAfter("{\"memberId\":\"" + president.getId() + "\",\"amount\":120}").amount(new BigDecimal("120.000")).build());
        auditLogRepo.save(AuditLog.builder().actorId(tresorier.getId()).actorEmail("tresorier@clubhub.tn").clubId("1")
                .action(AuditLog.ActionType.EXPENSE_VALIDATED).entityType("Expense").entityId("seed-expense-2")
                .valuesBefore("{\"status\":\"SUBMITTED\"}").valuesAfter("{\"status\":\"VALIDATED\"}")
                .amount(new BigDecimal("180.000")).build());
        auditLogRepo.save(AuditLog.builder().actorId(president.getId()).actorEmail("president@clubhub.tn").clubId("1")
                .action(AuditLog.ActionType.EXPENSE_APPROVED).entityType("Expense").entityId("seed-expense-3")
                .valuesBefore("{\"status\":\"VALIDATED\"}").valuesAfter("{\"status\":\"APPROVED\"}")
                .amount(new BigDecimal("95.000")).build());
        auditLogRepo.save(AuditLog.builder().actorId(president.getId()).actorEmail("president@clubhub.tn").clubId("1")
                .action(AuditLog.ActionType.BUDGET_CREATED).entityType("Budget").entityId("seed-budget-1")
                .valuesAfter("{\"label\":\"Budget annuel\",\"total\":5000}").build());

        // Entrainer les modeles ML (anomalies Isolation Forest + retard paiement Random Forest)
        mlAnomalyService.trainModel();
        latePaymentPredictor.trainModel();

        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("status", "OK");
        response.put("users", userRepo.count());
        response.put("rules", cotisationRuleRepo.count());
        response.put("payments", paymentRepo.count());
        response.put("expenses", expenseRepo.count());
        response.put("budgets", budgetRepo.count());
        response.put("auditLogs", auditLogRepo.count());
        response.put("mlAnomalyModel", mlAnomalyService.getModelStatus());
        response.put("mlLatePaymentModel", latePaymentPredictor.getModelStatus());
        return ResponseEntity.ok(response);
    }

    // Endpoint public pour retrain ML (sans auth, pour demo)
    @PostMapping("/ml/retrain")
    public ResponseEntity<Map<String, Object>> retrainMl() {
        mlAnomalyService.trainModel();
        return ResponseEntity.ok(Map.of("model", mlAnomalyService.getModelStatus()));
    }

    // Endpoint public pour voir les anomalies detectees (sans auth, pour demo)
    @GetMapping("/anomalies/ml")
    public ResponseEntity<?> mlAnomalies() {
        return ResponseEntity.ok(mlAnomalyService.detectAnomalies("1"));
    }

    // Debug: scores bruts de toutes les expenses (voir distribution)
    @GetMapping("/anomalies/ml/all")
    public ResponseEntity<?> mlAllScores() {
        return ResponseEntity.ok(mlAnomalyService.scoreAllExpenses("1"));
    }

    // Re-entrainement Random Forest (prediction retards)
    @PostMapping("/ml/late-payment/retrain")
    public ResponseEntity<Map<String, Object>> retrainLatePaymentMl() {
        latePaymentPredictor.trainModel();
        return ResponseEntity.ok(Map.of("model", latePaymentPredictor.getModelStatus()));
    }

    // Prediction retard pour tous les membres du club 1
    @GetMapping("/late-payment/predictions")
    public ResponseEntity<?> latePaymentPredictions() {
        return ResponseEntity.ok(latePaymentPredictor.predictForAllMembers("1"));
    }

    // Toutes les anomalies (paiements + depenses ML + doublons) pour le club 1
    @GetMapping("/anomalies/all")
    public ResponseEntity<?> allAnomalies() {
        return ResponseEntity.ok(anomalyService.detectAnomalies("1"));
    }

    // Solde net (calcul rapide pour verif sans auth)
    @GetMapping("/balance")
    public ResponseEntity<Map<String, Object>> balance() {
        BigDecimal totalCollected = paymentRepo.findByClubIdOrderByCreatedAtDesc("1").stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PAID)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalApproved = expenseRepo.findByClubIdOrderByCreatedAtDesc("1").stream()
                .filter(e -> e.getStatus() == Expense.ExpenseStatus.APPROVED)
                .map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long approvedCount = expenseRepo.findByClubIdOrderByCreatedAtDesc("1").stream()
                .filter(e -> e.getStatus() == Expense.ExpenseStatus.APPROVED).count();
        long paidCount = paymentRepo.findByClubIdOrderByCreatedAtDesc("1").stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PAID).count();

        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("totalCollected_TND", totalCollected);
        response.put("paidPaymentsCount", paidCount);
        response.put("totalExpensesApproved_TND", totalApproved);
        response.put("approvedExpensesCount", approvedCount);
        response.put("soldeNet_TND", totalCollected.subtract(totalApproved));
        return ResponseEntity.ok(response);
    }

    // ==================== GENERATION DONNEES ML ====================
    // Distribution realiste par categorie (moyenne, ecart-type en TND)
    private static final Map<Expense.ExpenseCategory, double[]> CATEGORY_STATS = Map.of(
            Expense.ExpenseCategory.FOURNITURES, new double[]{45, 15},
            Expense.ExpenseCategory.TRANSPORT, new double[]{180, 50},
            Expense.ExpenseCategory.HEBERGEMENT, new double[]{420, 80},
            Expense.ExpenseCategory.RESTAURATION, new double[]{95, 25},
            Expense.ExpenseCategory.MATERIEL, new double[]{310, 70},
            Expense.ExpenseCategory.COMMUNICATION, new double[]{55, 20},
            Expense.ExpenseCategory.EVENEMENT, new double[]{620, 150},
            Expense.ExpenseCategory.AUTRE, new double[]{100, 40}
    );

    private static final Map<Expense.ExpenseCategory, String[]> CATEGORY_DESCRIPTIONS = Map.of(
            Expense.ExpenseCategory.FOURNITURES, new String[]{"Stylos et papeterie", "Cahiers et classeurs", "Cartouches imprimante", "Petites fournitures bureau", "Consommables reunion"},
            Expense.ExpenseCategory.TRANSPORT, new String[]{"Location minibus", "Taxi pour conference", "Essence voiture location", "Billet train TGV", "Bus deplacement equipe"},
            Expense.ExpenseCategory.HEBERGEMENT, new String[]{"Hotel 1 nuit", "Hotel 2 nuits membres", "Auberge jeunesse", "Residence conference", "Appartement locatif weekend"},
            Expense.ExpenseCategory.RESTAURATION, new String[]{"Buffet reunion", "Cafe et viennoiseries", "Dejeuner equipe", "Repas presidentiel", "Snacks atelier"},
            Expense.ExpenseCategory.MATERIEL, new String[]{"Table et chaises", "Ecran video projection", "Sono portable", "Banderole evenement", "Kit decoration"},
            Expense.ExpenseCategory.COMMUNICATION, new String[]{"Flyers evenement", "Affiches A3", "Cartes de visite", "Post LinkedIn sponsorise", "Emailing campagne"},
            Expense.ExpenseCategory.EVENEMENT, new String[]{"Soiree integration", "Journee portes ouvertes", "Gala annuel", "Hackathon 48h", "Conference inter-clubs"},
            Expense.ExpenseCategory.AUTRE, new String[]{"Frais divers", "Petits achats", "Caisse de tresorerie", "Remboursement ponctuel", "Depense exceptionnelle"}
    );

    private void generateBulkExpenses(List<User> members, User tresorier, User president, int count) {
        Random rnd = new Random(42L);  // Seed fixe pour reproductibilite
        Expense.ExpenseCategory[] categories = Expense.ExpenseCategory.values();
        // Distribution statuts realiste club mi-exercice :
        // 15% APPROVED (deja payees), 30% VALIDATED (en attente president),
        // 30% SUBMITTED (en attente tresorier), 25% REJECTED.
        // -> Solde ~-2000 TND : deficit defendable "milieu d'exercice, evenements Q1 engages,
        //    cotisations annuelles pas toutes rentrees"
        Expense.ExpenseStatus[] statuses = {
                Expense.ExpenseStatus.APPROVED, Expense.ExpenseStatus.APPROVED, Expense.ExpenseStatus.APPROVED,
                Expense.ExpenseStatus.VALIDATED, Expense.ExpenseStatus.VALIDATED, Expense.ExpenseStatus.VALIDATED,
                Expense.ExpenseStatus.VALIDATED, Expense.ExpenseStatus.VALIDATED, Expense.ExpenseStatus.VALIDATED,
                Expense.ExpenseStatus.SUBMITTED, Expense.ExpenseStatus.SUBMITTED, Expense.ExpenseStatus.SUBMITTED,
                Expense.ExpenseStatus.SUBMITTED, Expense.ExpenseStatus.SUBMITTED, Expense.ExpenseStatus.SUBMITTED,
                Expense.ExpenseStatus.REJECTED, Expense.ExpenseStatus.REJECTED, Expense.ExpenseStatus.REJECTED,
                Expense.ExpenseStatus.REJECTED, Expense.ExpenseStatus.REJECTED
        };

        for (int i = 0; i < count; i++) {
            Expense.ExpenseCategory cat = categories[rnd.nextInt(categories.length)];
            double[] stats = CATEGORY_STATS.get(cat);
            // Montant gaussien, tronque a [mean - 2*std, mean + 2*std], min 5 TND
            double amount = Math.max(5, stats[0] + rnd.nextGaussian() * stats[1]);
            amount = Math.round(amount * 1000.0) / 1000.0;  // 3 decimales TND

            Expense.ExpenseStatus status = statuses[rnd.nextInt(statuses.length)];
            User submitter = members.get(rnd.nextInt(members.size()));
            String[] descs = CATEGORY_DESCRIPTIONS.get(cat);
            String desc = descs[rnd.nextInt(descs.length)];

            // Date aleatoire dans les 270 derniers jours
            LocalDateTime submitted = LocalDateTime.now().minusDays(rnd.nextInt(270)).minusHours(rnd.nextInt(24));

            // 3 devis avec variation +/- 15%
            BigDecimal baseAmount = BigDecimal.valueOf(amount).setScale(3, RoundingMode.HALF_UP);
            List<Expense.Quote> quotes = new ArrayList<>();
            quotes.add(Expense.Quote.builder().providerName("Fournisseur A").amount(baseAmount).description(desc + " - offre A").selected(status != Expense.ExpenseStatus.SUBMITTED).build());
            quotes.add(Expense.Quote.builder().providerName("Fournisseur B").amount(baseAmount.multiply(new BigDecimal("1.10")).setScale(3, RoundingMode.HALF_UP)).description(desc + " - offre B premium").selected(false).build());
            quotes.add(Expense.Quote.builder().providerName("Fournisseur C").amount(baseAmount.multiply(new BigDecimal("0.92")).setScale(3, RoundingMode.HALF_UP)).description(desc + " - offre C eco").selected(false).build());

            Expense.ExpenseBuilder builder = Expense.builder()
                    .clubId("1")
                    .submittedByMemberId(submitter.getId())
                    .title(desc)
                    .description(desc + " - " + cat.name().toLowerCase())
                    .amount(baseAmount)
                    .status(status)
                    .category(cat)
                    .categoryConfidenceScore(70 + rnd.nextInt(30))
                    .quotes(quotes)
                    .submittedAt(submitted);

            if (status == Expense.ExpenseStatus.VALIDATED || status == Expense.ExpenseStatus.APPROVED) {
                builder.validatedByTreasurerId(tresorier.getId()).validatedAt(submitted.plusDays(1 + rnd.nextInt(3)));
            }
            if (status == Expense.ExpenseStatus.APPROVED) {
                builder.approvedByPresidentId(president.getId()).approvedAt(submitted.plusDays(3 + rnd.nextInt(4))).categoryValidatedByTreasurer(true);
            }
            if (status == Expense.ExpenseStatus.REJECTED) {
                builder.rejectionReason("Budget depasse ou justificatif manquant");
            }

            expenseRepo.save(builder.build());
        }
    }

    /**
     * Genere 180+ paiements historiques avec patterns de retard par membre.
     * Simule 2 ans d'historique mensuel + quelques annuels.
     * Chaque membre a une "propension au retard" differente (seed determinist).
     */
    private void generateBulkPayments(List<User> members, CotisationRule annual, CotisationRule monthly) {
        Random rnd = new Random(123L);

        // Propension de retard par membre (0.0 = jamais, 1.0 = toujours)
        // Patterns realistes: president/tresorier = fiables, dylan/omar = peu fiables
        Map<String, Double> lateRates = new HashMap<>();
        lateRates.put(members.get(0).getId(), 0.02);  // president - 2% retard
        lateRates.put(members.get(1).getId(), 0.03);  // tresorier - 3%
        lateRates.put(members.get(2).getId(), 0.05);  // bureau - 5%
        lateRates.put(members.get(3).getId(), 0.15);  // sana - 15%
        lateRates.put(members.get(4).getId(), 0.55);  // omar - 55% (mauvais payeur)
        lateRates.put(members.get(5).getId(), 0.08);  // nour
        lateRates.put(members.get(6).getId(), 0.35);  // yassine
        lateRates.put(members.get(7).getId(), 0.10);  // amira
        lateRates.put(members.get(8).getId(), 0.70);  // dylan - 70% (tres mauvais payeur)

        // Generer 2 ans d'historique mensuel pour chaque membre
        LocalDate startDate = LocalDate.of(2024, 1, 1);
        for (User member : members) {
            // Dylan : on garde uniquement les 3 cotisations LATE manuelles (demo paiement membre)
            if ("kayzeurdylan2@gmail.com".equals(member.getEmail())) continue;
            double lateRate = lateRates.getOrDefault(member.getId(), 0.20);

            // 20 paiements mensuels (2 ans)
            for (int month = 0; month < 20; month++) {
                LocalDate dueDate = startDate.plusMonths(month);
                if (dueDate.isAfter(LocalDate.now().minusDays(5))) break;  // ne pas creer de futur

                boolean isLate = rnd.nextDouble() < lateRate;
                Payment.PaymentStatus status = isLate ? Payment.PaymentStatus.LATE : Payment.PaymentStatus.PAID;
                LocalDateTime paidAt = isLate ? null : dueDate.plusDays(rnd.nextInt(5)).atTime(10 + rnd.nextInt(8), rnd.nextInt(60));

                paymentRepo.save(Payment.builder()
                        .memberId(member.getId())
                        .clubId("1")
                        .cotisationRuleId(monthly.getId())
                        .amount(new BigDecimal("15.000"))
                        .status(status)
                        .dueDate(dueDate)
                        .paidAt(paidAt)
                        .build());
            }

            // 2 paiements annuels (2024-2025, 2025-2026)
            for (int year = 0; year < 2; year++) {
                LocalDate dueDate = LocalDate.of(2024 + year, 9, 1);
                if (dueDate.isAfter(LocalDate.now().minusDays(5))) break;

                boolean isLate = rnd.nextDouble() < lateRate;
                Payment.PaymentStatus status = isLate ? Payment.PaymentStatus.LATE : Payment.PaymentStatus.PAID;
                LocalDateTime paidAt = isLate ? null : dueDate.plusDays(rnd.nextInt(14)).atTime(14, 0);

                paymentRepo.save(Payment.builder()
                        .memberId(member.getId())
                        .clubId("1")
                        .cotisationRuleId(annual.getId())
                        .amount(new BigDecimal("120.000"))
                        .status(status)
                        .dueDate(dueDate)
                        .paidAt(paidAt)
                        .build());
            }
        }
    }

    private void injectVolontaryAnomalies(List<User> members, User tresorier, User president) {
        // 7 anomalies volontaires que le modele doit detecter
        // Chacune est > 3-sigma de la moyenne de sa categorie
        Object[][] anomalies = {
                // {category, amount_TND, titre, description}
                {Expense.ExpenseCategory.TRANSPORT, "2500.000", "[TEST-ANOMALIE] Transport suspicieux", "Location bus luxe 3 semaines"},
                {Expense.ExpenseCategory.RESTAURATION, "850.000", "[TEST-ANOMALIE] Buffet demesure", "Repas gastronomique 8 personnes"},
                {Expense.ExpenseCategory.FOURNITURES, "1200.000", "[TEST-ANOMALIE] Fournitures massive", "Achat stylos en gros"},
                {Expense.ExpenseCategory.COMMUNICATION, "680.000", "[TEST-ANOMALIE] Campagne exorbitante", "Pub radio nationale"},
                {Expense.ExpenseCategory.MATERIEL, "30.000", "[TEST-ANOMALIE] Materiel sous-value", "Ordinateur complet"},
                {Expense.ExpenseCategory.HEBERGEMENT, "3200.000", "[TEST-ANOMALIE] Hotel luxe", "Suite presidentielle 5 nuits"},
                {Expense.ExpenseCategory.EVENEMENT, "45.000", "[TEST-ANOMALIE] Evenement sous-facture", "Gala annuel"}
        };

        for (Object[] a : anomalies) {
            Expense.ExpenseCategory cat = (Expense.ExpenseCategory) a[0];
            BigDecimal amount = new BigDecimal((String) a[1]).setScale(3, RoundingMode.HALF_UP);
            String title = (String) a[2];
            String desc = (String) a[3];
            User submitter = members.get(1);  // tresorier

            List<Expense.Quote> quotes = List.of(
                    Expense.Quote.builder().providerName("Fournisseur X").amount(amount).description(desc).selected(true).build(),
                    Expense.Quote.builder().providerName("Fournisseur Y").amount(amount.multiply(new BigDecimal("1.05")).setScale(3, RoundingMode.HALF_UP)).description(desc + " alt").selected(false).build(),
                    Expense.Quote.builder().providerName("Fournisseur Z").amount(amount.multiply(new BigDecimal("0.95")).setScale(3, RoundingMode.HALF_UP)).description(desc + " eco").selected(false).build()
            );

            expenseRepo.save(Expense.builder()
                    .clubId("1")
                    .submittedByMemberId(submitter.getId())
                    .title(title)
                    .description(desc)
                    .amount(amount)
                    .status(Expense.ExpenseStatus.SUBMITTED)
                    .category(cat)
                    .categoryConfidenceScore(85)
                    .quotes(quotes)
                    .submittedAt(LocalDateTime.now().minusDays(5))
                    .build());
        }
    }
}
