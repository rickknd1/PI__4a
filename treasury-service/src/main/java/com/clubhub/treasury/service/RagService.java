package com.clubhub.treasury.service;

import com.clubhub.treasury.entity.*;
import com.clubhub.treasury.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * RAG (Retrieval-Augmented Generation) Service
 *
 * 1. Detecte l'intention de la question utilisateur
 * 2. Recupere les donnees pertinentes depuis la BDD
 * 3. Construit un contexte riche pour Gemini
 * 4. Gemini genere une reponse informee par les vraies donnees
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RagService {

    private final PaymentRepository paymentRepo;
    private final ExpenseRepository expenseRepo;
    private final BudgetRepository budgetRepo;
    private final CotisationRuleRepository ruleRepo;
    private final AuditLogRepository auditRepo;
    private final UserRepository userRepo;
    private final NotificationRepository notifRepo;
    private final GeminiService geminiService;

    /**
     * Point d'entree RAG : question -> retrieval -> augmented prompt -> generation
     */
    public String askWithRag(Long clubId, String question) {
        Set<Intent> intents = detectIntents(question);
        log.info("[RAG] Question: '{}' -> Intents: {}", question, intents);

        // Chemin rapide sans LLM : reponse structuree generee directement depuis la BDD
        // (plus precise car utilise les vrais objets, gere le temporel, les categories, etc.)
        if (!geminiService.isAvailable()) {
            return answerWithoutLlm(clubId, question, intents);
        }

        // Chemin avec Gemini (si cle API configuree)
        String retrievedContext = retrieveContext(clubId, intents);
        String augmentedPrompt = buildAugmentedPrompt(question, retrievedContext);
        return geminiService.askWithFallbackContext(augmentedPrompt, question, retrievedContext);
    }

    // === INTENT DETECTION ===

    enum Intent {
        PAYMENTS, LATE_MEMBERS, RECOVERY_RATE, BUDGET, EXPENSES,
        COTISATION_RULES, MEMBERS, ANOMALIES, PREDICTIONS,
        AUDIT, NOTIFICATIONS, GENERAL_STATS
    }

    private Set<Intent> detectIntents(String question) {
        String q = question.toLowerCase();
        Set<Intent> intents = new HashSet<>();

        // Toujours inclure les stats generales
        intents.add(Intent.GENERAL_STATS);

        if (q.contains("paiement") || q.contains("paye") || q.contains("collecte") || q.contains("recu"))
            intents.add(Intent.PAYMENTS);
        if (q.contains("retard") || q.contains("late") || q.contains("impaye") || q.contains("relance"))
            intents.add(Intent.LATE_MEMBERS);
        if (q.contains("taux") || q.contains("recouvrement") || q.contains("performance"))
            intents.add(Intent.RECOVERY_RATE);
        if (q.contains("budget") || q.contains("consomm") || q.contains("restant") || q.contains("depasse"))
            intents.add(Intent.BUDGET);
        if (q.contains("depense") || q.contains("facture") || q.contains("rembours") || q.contains("approuv"))
            intents.add(Intent.EXPENSES);
        if (q.contains("cotisation") || q.contains("regle") || q.contains("montant") || q.contains("frequence"))
            intents.add(Intent.COTISATION_RULES);
        if (q.contains("membre") || q.contains("utilisateur") || q.contains("inscrit"))
            intents.add(Intent.MEMBERS);
        if (q.contains("anomalie") || q.contains("suspect") || q.contains("fraude") || q.contains("bizarre"))
            intents.add(Intent.ANOMALIES);
        if (q.contains("prevision") || q.contains("prediction") || q.contains("futur") || q.contains("prochain"))
            intents.add(Intent.PREDICTIONS);
        if (q.contains("audit") || q.contains("historique") || q.contains("log") || q.contains("trace"))
            intents.add(Intent.AUDIT);
        if (q.contains("notification") || q.contains("email") || q.contains("alerte"))
            intents.add(Intent.NOTIFICATIONS);

        return intents;
    }

    // === DATA RETRIEVAL ===

    private String retrieveContext(Long clubId, Set<Intent> intents) {
        StringBuilder ctx = new StringBuilder();
        ctx.append("=== DONNEES REELLES DU CLUB (extraites de la base de donnees) ===\n\n");

        if (intents.contains(Intent.GENERAL_STATS)) {
            ctx.append(retrieveGeneralStats(clubId));
        }
        if (intents.contains(Intent.PAYMENTS) || intents.contains(Intent.RECOVERY_RATE)) {
            ctx.append(retrievePayments(clubId));
        }
        if (intents.contains(Intent.LATE_MEMBERS)) {
            ctx.append(retrieveLateMembers(clubId));
        }
        if (intents.contains(Intent.BUDGET)) {
            ctx.append(retrieveBudgets(clubId));
        }
        if (intents.contains(Intent.EXPENSES)) {
            ctx.append(retrieveExpenses(clubId));
        }
        if (intents.contains(Intent.COTISATION_RULES)) {
            ctx.append(retrieveRules(clubId));
        }
        if (intents.contains(Intent.MEMBERS)) {
            ctx.append(retrieveMembers(clubId));
        }
        if (intents.contains(Intent.AUDIT)) {
            ctx.append(retrieveAuditLogs(clubId));
        }
        if (intents.contains(Intent.NOTIFICATIONS)) {
            ctx.append(retrieveNotifications(clubId));
        }

        return ctx.toString();
    }

    private String retrieveGeneralStats(Long clubId) {
        List<Payment> allPayments = paymentRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        BigDecimal totalPaid = allPayments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PAID)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPending = allPayments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PENDING)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalLate = allPayments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.LATE)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long membersUp = allPayments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PAID)
                .map(Payment::getMemberId).distinct().count();
        long membersLate = allPayments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.LATE)
                .map(Payment::getMemberId).distinct().count();
        long totalUsers = userRepo.findByClubId(clubId).size();
        long totalPayments = allPayments.size();
        long totalExpenses = expenseRepo.findByClubIdOrderByCreatedAtDesc(clubId).size();

        double recoveryRate = 0;
        BigDecimal total = totalPaid.add(totalPending);
        if (total.compareTo(BigDecimal.ZERO) > 0)
            recoveryRate = totalPaid.divide(total, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue();

        return String.format("""
                [STATISTIQUES GENERALES]
                - Total collecte (paiements confirmes): %s TND
                - Total en attente: %s TND
                - Total en retard: %s TND
                - Taux de recouvrement: %.1f%%
                - Membres a jour: %d / Membres en retard: %d / Total membres: %d
                - Nombre total de paiements: %d
                - Nombre total de depenses: %d

                """, totalPaid, totalPending, totalLate, recoveryRate, membersUp, membersLate, totalUsers, totalPayments, totalExpenses);
    }

    private String retrievePayments(Long clubId) {
        List<Payment> payments = paymentRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        Map<String, Long> byStatus = payments.stream()
                .collect(Collectors.groupingBy(p -> p.getStatus().name(), Collectors.counting()));

        StringBuilder sb = new StringBuilder("[PAIEMENTS - detail par statut]\n");
        byStatus.forEach((status, count) -> sb.append(String.format("- %s: %d paiements\n", status, count)));

        // 5 derniers paiements
        sb.append("\nDerniers paiements:\n");
        payments.stream().limit(5).forEach(p -> sb.append(String.format(
                "  #%s | Membre %s | %s TND | %s | Echeance: %s | Paye: %s\n",
                p.getId(), p.getMemberId(), p.getAmount(), p.getStatus(),
                p.getDueDate(), p.getPaidAt() != null ? p.getPaidAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : "non")));
        sb.append("\n");
        return sb.toString();
    }

    private String retrieveLateMembers(Long clubId) {
        List<Payment> latePayments = paymentRepo.findByClubIdAndStatus(clubId, Payment.PaymentStatus.LATE);
        StringBuilder sb = new StringBuilder("[MEMBRES EN RETARD]\n");
        if (latePayments.isEmpty()) {
            sb.append("Aucun membre en retard.\n\n");
        } else {
            sb.append(String.format("%d paiement(s) en retard:\n", latePayments.size()));
            latePayments.forEach(p -> {
                User member = userRepo.findById(p.getMemberId()).orElse(null);
                String name = member != null ? member.getFullName() + " (" + member.getEmail() + ")" : "Membre #" + p.getMemberId();
                sb.append(String.format("  - %s | %s TND | Echeance depassee: %s\n", name, p.getAmount(), p.getDueDate()));
            });
            sb.append("\n");
        }
        return sb.toString();
    }

    private String retrieveBudgets(Long clubId) {
        List<Budget> budgets = budgetRepo.findByClubId(clubId);
        StringBuilder sb = new StringBuilder("[BUDGETS]\n");
        budgets.forEach(b -> sb.append(String.format(
                "  - '%s' | Total: %s TND | Consomme: %s TND (%d%%) | Restant: %s TND | Periode: %s au %s\n",
                b.getLabel(), b.getTotalAmount(), b.getConsumedAmount(), b.getConsumptionPercentage(),
                b.getRemainingAmount(), b.getPeriodStart(), b.getPeriodEnd())));
        sb.append("\n");
        return sb.toString();
    }

    private String retrieveExpenses(Long clubId) {
        List<Expense> expenses = expenseRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        Map<String, Long> byStatus = expenses.stream()
                .collect(Collectors.groupingBy(e -> e.getStatus().name(), Collectors.counting()));

        StringBuilder sb = new StringBuilder("[DEPENSES]\n");
        byStatus.forEach((status, count) -> sb.append(String.format("- %s: %d depenses\n", status, count)));

        BigDecimal totalApproved = expenses.stream()
                .filter(e -> e.getStatus() == Expense.ExpenseStatus.APPROVED)
                .map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        sb.append(String.format("- Total depenses approuvees: %s TND\n", totalApproved));

        sb.append("\nDernieres depenses:\n");
        expenses.stream().limit(5).forEach(e -> sb.append(String.format(
                "  #%s | '%s' | %s TND | %s | Categorie: %s (%d%% confiance IA)\n",
                e.getId(), e.getTitle(), e.getAmount(), e.getStatus(),
                e.getCategory() != null ? e.getCategory().name() : "?",
                e.getCategoryConfidenceScore() != null ? e.getCategoryConfidenceScore() : 0)));
        sb.append("\n");
        return sb.toString();
    }

    private String retrieveRules(Long clubId) {
        var rules = ruleRepo.findByClubIdAndActiveTrue(clubId);
        StringBuilder sb = new StringBuilder("[REGLES DE COTISATION ACTIVES]\n");
        rules.forEach(r -> sb.append(String.format(
                "  - '%s' | %s TND | %s | Debut: %s | Exemption: %s | Echelonnement: %s (%s max)\n",
                r.getName(), r.getAmount(), r.getFrequency(), r.getStartDate(),
                r.isAllowExemption() ? "oui" : "non",
                r.isAllowInstallments() ? "oui" : "non",
                r.getMaxInstallments() != null ? r.getMaxInstallments() : "-")));
        sb.append("\n");
        return sb.toString();
    }

    private String retrieveMembers(Long clubId) {
        List<User> users = userRepo.findByClubId(clubId);
        StringBuilder sb = new StringBuilder("[MEMBRES DU CLUB]\n");
        users.forEach(u -> sb.append(String.format(
                "  - %s (%s) | Role: %s | Email: %s\n",
                u.getFullName(), u.getId(), u.getRole(), u.getEmail())));
        sb.append(String.format("Total: %d membres\n\n", users.size()));
        return sb.toString();
    }

    private String retrieveAuditLogs(Long clubId) {
        var logs = auditRepo.findByClubIdOrderByTimestampDesc(clubId);
        StringBuilder sb = new StringBuilder("[JOURNAL D'AUDIT - 10 dernieres actions]\n");
        logs.stream().limit(10).forEach(l -> sb.append(String.format(
                "  %s | %s | %s #%s | Par: %s | Montant: %s\n",
                l.getTimestamp() != null ? l.getTimestamp().format(DateTimeFormatter.ofPattern("dd/MM HH:mm")) : "?",
                l.getAction(), l.getEntityType(), l.getEntityId(), l.getActorEmail(),
                l.getAmount() != null ? l.getAmount() + " TND" : "-")));
        sb.append("\n");
        return sb.toString();
    }

    private String retrieveNotifications(Long clubId) {
        var notifs = notifRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        StringBuilder sb = new StringBuilder("[NOTIFICATIONS RECENTES]\n");
        sb.append(String.format("Total: %d notifications | Non lues: %d\n",
                notifs.size(), notifs.stream().filter(n -> !n.isRead()).count()));
        notifs.stream().limit(5).forEach(n -> sb.append(String.format(
                "  - [%s] %s -> %s | Email envoye: %s\n",
                n.getType(), n.getTitle(), n.getRecipientEmail(), n.isEmailSent() ? "oui" : "non")));
        sb.append("\n");
        return sb.toString();
    }

    // === PROMPT AUGMENTATION ===

    private String buildAugmentedPrompt(String question, String context) {
        return """
                Tu es l'assistant tresorerie de ClubHub, une plateforme de gestion de clubs universitaires.
                Devise: TND (Dinar Tunisien).

                REGLES STRICTES:
                - Reponds UNIQUEMENT en francais, en langage naturel (phrases completes, pas de JSON).
                - Base-toi UNIQUEMENT sur les donnees reelles ci-dessous. Ne fabrique aucun chiffre.
                - Sois concis: 2-4 phrases maximum.
                - Cite les montants exacts en TND.
                - Ne retourne JAMAIS de JSON, de code, ou de structure technique.
                - Si tu ne sais pas, dis simplement "Je n'ai pas cette information."

                %s

                === QUESTION ===
                %s

                Reponds en francais, en langage naturel (pas de JSON).
                """.formatted(context, question);
    }

    // =========================================================================
    // REPONSE DIRECTE SANS LLM
    // Logique: intent + temporel + nom du membre + categorie -> reponse naturelle
    // =========================================================================

    /** Fenetre temporelle parsee depuis la question */
    static class TimeWindow {
        LocalDate since;  // debut (incluse)
        String label;     // ex: "derniers 2 jours", "ce mois", "aujourd'hui"

        TimeWindow(LocalDate since, String label) {
            this.since = since;
            this.label = label;
        }
    }

    private static final Map<String, Integer> NUMBER_WORDS = Map.ofEntries(
        Map.entry("un", 1), Map.entry("une", 1),
        Map.entry("deux", 2), Map.entry("trois", 3), Map.entry("quatre", 4),
        Map.entry("cinq", 5), Map.entry("six", 6), Map.entry("sept", 7),
        Map.entry("huit", 8), Map.entry("neuf", 9), Map.entry("dix", 10),
        Map.entry("onze", 11), Map.entry("douze", 12), Map.entry("vingt", 20),
        Map.entry("trente", 30), Map.entry("quarante", 40), Map.entry("cinquante", 50)
    );

    /** Convertit "deux" -> 2, "3" -> 3, "dix" -> 10 */
    private int parseNumber(String s) {
        if (s == null) return 1;
        s = s.trim().toLowerCase();
        try { return Integer.parseInt(s); } catch (NumberFormatException ignore) {}
        return NUMBER_WORDS.getOrDefault(s, 1);
    }

    /** Parse "2 jours", "deux semaines", "ce mois", "hier", "aujourd'hui", "il y a 3 ans" */
    TimeWindow parseTimeWindow(String question) {
        String q = question.toLowerCase().replace("'", " ").replace("-", " ");
        LocalDate today = LocalDate.now();

        if (q.contains("aujourd") || q.contains("ce jour")) return new TimeWindow(today, "aujourd'hui");
        if (q.contains("hier") && !q.contains("avant hier")) return new TimeWindow(today.minusDays(1), "hier");
        if (q.contains("avant hier")) return new TimeWindow(today.minusDays(2), "avant-hier");
        if (q.contains("cette semaine")) return new TimeWindow(today.minusDays(today.getDayOfWeek().getValue() - 1), "cette semaine");
        if (q.contains("semaine derniere") || q.contains("derniere semaine")) return new TimeWindow(today.minusDays(7), "la semaine derniere");
        if (q.contains("ce mois") || q.contains("mois courant")) return new TimeWindow(today.withDayOfMonth(1), "ce mois-ci");
        if (q.contains("mois dernier") || q.contains("dernier mois")) return new TimeWindow(today.minusMonths(1).withDayOfMonth(1), "le mois dernier");
        if (q.contains("cette annee") || q.contains("annee courante")) return new TimeWindow(today.withDayOfYear(1), "cette annee");
        if (q.contains("annee derniere") || q.contains("derniere annee")) return new TimeWindow(today.minusYears(1).withDayOfYear(1), "l'annee derniere");
        if (q.contains("trimestre")) return new TimeWindow(today.minusMonths(3), "ce trimestre");

        // Regex : "2 jours", "deux derniers mois", "il y a 3 semaines", "derniers 5 ans"
        Pattern p = Pattern.compile(
            "(?:il y a|dernier[es]*|depuis|derniers?)\\s*(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|vingt|trente|quarante|cinquante)\\s*(jour|semaine|mois|an|annee)s?"
            + "|(\\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|vingt|trente|quarante|cinquante)\\s*(?:derniers?\\s*)?(jour|semaine|mois|an|annee)s?"
        );
        Matcher m = p.matcher(q);
        if (m.find()) {
            String num = m.group(1) != null ? m.group(1) : m.group(3);
            String unit = m.group(2) != null ? m.group(2) : m.group(4);
            int n = parseNumber(num);
            LocalDate since;
            String label;
            switch (unit) {
                case "jour":     since = today.minusDays(n);   label = n + " dernier" + (n>1?"s":"") + " jour" + (n>1?"s":""); break;
                case "semaine":  since = today.minusWeeks(n);  label = n + " dernier" + (n>1?"es":"e") + " semaine" + (n>1?"s":""); break;
                case "mois":     since = today.minusMonths(n); label = n + " dernier" + (n>1?"s":"") + " mois"; break;
                case "an":
                case "annee":    since = today.minusYears(n);  label = n + " dernier" + (n>1?"es":"e") + " annee" + (n>1?"s":""); break;
                default: return null;
            }
            return new TimeWindow(since, label);
        }
        return null;
    }

    /** Recherche un membre par nom, prenom ou email dans la question */
    private User findMemberMention(String question, Long clubId) {
        String q = question.toLowerCase();
        List<User> users = userRepo.findByClubId(clubId);
        for (User u : users) {
            String first = u.getFirstName() != null ? u.getFirstName().toLowerCase() : "";
            String last = u.getLastName() != null ? u.getLastName().toLowerCase() : "";
            String email = u.getEmail() != null ? u.getEmail().toLowerCase() : "";
            if (!first.isBlank() && q.contains(first)) return u;
            if (!last.isBlank() && q.contains(last)) return u;
            if (!email.isBlank() && q.contains(email.split("@")[0])) return u;
        }
        return null;
    }

    /** Tente d'extraire une categorie de depense mentionnee dans la question */
    private Expense.ExpenseCategory findCategoryMention(String question) {
        String q = question.toLowerCase();
        for (Expense.ExpenseCategory c : Expense.ExpenseCategory.values()) {
            if (q.contains(c.name().toLowerCase())) return c;
        }
        // Alias courants
        if (q.contains("bouffe") || q.contains("buffet") || q.contains("resto")) return Expense.ExpenseCategory.RESTAURATION;
        if (q.contains("bus") || q.contains("voiture") || q.contains("trajet")) return Expense.ExpenseCategory.TRANSPORT;
        if (q.contains("flyer") || q.contains("print") || q.contains("impress")) return Expense.ExpenseCategory.COMMUNICATION;
        if (q.contains("hotel") || q.contains("chambre") || q.contains("nuit")) return Expense.ExpenseCategory.HEBERGEMENT;
        return null;
    }

    // ========== DISPATCHER ==========

    public String answerWithoutLlm(Long clubId, String question, Set<Intent> intents) {
        if (question == null || question.trim().isEmpty()) return helpText();
        String q = question.toLowerCase();

        if (q.contains("aide") || q.contains("help") || q.contains("que peux") || q.contains("capacite")) {
            return helpText();
        }
        if (q.matches(".*\\b(bonjour|salut|hello|hi|bsr|bonsoir|coucou)\\b.*")) {
            return greeting(clubId);
        }

        TimeWindow tw = parseTimeWindow(question);
        User member = findMemberMention(question, clubId);
        Expense.ExpenseCategory cat = findCategoryMention(question);

        // Ordre de priorite : intents les plus specifiques d'abord
        if (intents.contains(Intent.LATE_MEMBERS)) return answerLateMembers(clubId, tw);
        if (intents.contains(Intent.RECOVERY_RATE)) return answerRecoveryRate(clubId, tw);
        if (intents.contains(Intent.BUDGET)) return answerBudget(clubId, question);
        if (intents.contains(Intent.EXPENSES)) return answerExpenses(clubId, tw, cat, q);
        if (intents.contains(Intent.PAYMENTS)) return answerPayments(clubId, tw, member);
        if (intents.contains(Intent.COTISATION_RULES)) return answerRules(clubId);
        if (intents.contains(Intent.MEMBERS)) return answerMembers(clubId, member);
        if (intents.contains(Intent.ANOMALIES)) return answerAnomalies(clubId);
        if (intents.contains(Intent.PREDICTIONS)) return answerPredictions(clubId);
        if (intents.contains(Intent.AUDIT)) return answerAudit(clubId, tw);
        if (intents.contains(Intent.NOTIFICATIONS)) return answerNotifications(clubId);

        return greeting(clubId);
    }

    // ========== HANDLERS ==========

    private String greeting(Long clubId) {
        List<Payment> pays = paymentRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        BigDecimal collected = sumPayments(pays, Payment.PaymentStatus.PAID);
        BigDecimal late = sumPayments(pays, Payment.PaymentStatus.LATE);
        long lateCount = pays.stream().filter(p -> p.getStatus()==Payment.PaymentStatus.LATE).map(Payment::getMemberId).distinct().count();
        long totalUsers = userRepo.findByClubId(clubId).size();
        List<Expense> exps = expenseRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        long pendExp = exps.stream().filter(e -> e.getStatus()==Expense.ExpenseStatus.SUBMITTED).count();

        return String.format(
            "Bonjour ! Voici l'etat du club :\n"
            + "- Collecte : %s TND | En retard : %s TND (%d membre%s)\n"
            + "- %d membres au total | %d depense%s en attente de validation\n\n"
            + "Que voulez-vous savoir ? Exemples :\n"
            + "  - \"Depenses des 2 derniers mois\"\n"
            + "  - \"Qui est en retard ?\"\n"
            + "  - \"Budget restant\"\n"
            + "  - \"Top 3 plus grosses depenses\"\n"
            + "  - \"Anomalies ?\"",
            collected, late, lateCount, lateCount>1?"s":"", totalUsers, pendExp, pendExp>1?"s":"");
    }

    private String helpText() {
        return "Je peux t'aider sur les sujets suivants :\n"
            + "- PAIEMENTS : 'paiements de ce mois', 'paiements de Ali', 'taux de recouvrement'\n"
            + "- RETARDS : 'qui est en retard ?', 'membres en retard depuis 2 mois'\n"
            + "- DEPENSES : 'depenses des 7 derniers jours', 'depenses en TRANSPORT', 'top 5 plus grosses depenses'\n"
            + "- BUDGET : 'budget restant', 'budget communication', 'budgets depasses'\n"
            + "- COTISATIONS : 'regles actives', 'montants des cotisations'\n"
            + "- MEMBRES : 'liste des membres', 'info sur Sana'\n"
            + "- AUDIT : 'historique des actions', 'audit du dernier mois'\n"
            + "- ANOMALIES : 'y a-t-il des anomalies ?'\n"
            + "- PREDICTIONS : 'prevision revenus', 'estimation prochains mois'\n"
            + "Astuce : precise une periode (ex: 'il y a 3 semaines', 'ce mois', 'cette annee').";
    }

    private String answerLateMembers(Long clubId, TimeWindow tw) {
        List<Payment> lates = paymentRepo.findByClubIdAndStatus(clubId, Payment.PaymentStatus.LATE);
        if (tw != null) lates = lates.stream().filter(p -> p.getDueDate()!=null && !p.getDueDate().isBefore(tw.since)).collect(Collectors.toList());
        if (lates.isEmpty()) {
            return "Aucun paiement en retard" + (tw != null ? " pour " + tw.label : "") + ". Tout est a jour.";
        }
        BigDecimal total = lates.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        StringBuilder sb = new StringBuilder(String.format(
            "%d paiement(s) en retard%s pour un total de %s TND :\n",
            lates.size(), tw != null ? " ("+tw.label+")" : "", total));
        lates.stream().limit(10).forEach(p -> {
            User u = userRepo.findById(p.getMemberId()).orElse(null);
            String name = u != null ? u.getFullName() : "Membre #" + p.getMemberId();
            long days = p.getDueDate() != null ? ChronoUnit.DAYS.between(p.getDueDate(), LocalDate.now()) : 0;
            sb.append(String.format("- %s : %s TND (echeance %s, %d jours de retard)\n",
                name, p.getAmount(), p.getDueDate(), days));
        });
        if (lates.size() > 10) sb.append("... et ").append(lates.size()-10).append(" autre(s).");
        return sb.toString();
    }

    private String answerRecoveryRate(Long clubId, TimeWindow tw) {
        List<Payment> pays = paymentRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        if (tw != null) pays = pays.stream().filter(p -> p.getCreatedAt()!=null && !p.getCreatedAt().isBefore(tw.since.atStartOfDay())).collect(Collectors.toList());
        BigDecimal paid = sumPayments(pays, Payment.PaymentStatus.PAID);
        BigDecimal pending = sumPayments(pays, Payment.PaymentStatus.PENDING);
        BigDecimal late = sumPayments(pays, Payment.PaymentStatus.LATE);
        BigDecimal total = paid.add(pending).add(late);
        double rate = total.compareTo(BigDecimal.ZERO) > 0
            ? paid.divide(total, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue() : 0;
        String verdict = rate >= 90 ? "Excellent" : rate >= 75 ? "Bon" : rate >= 50 ? "Moyen" : "Insuffisant";
        return String.format(
            "Taux de recouvrement%s : %.1f%% (%s).\n"
            + "- Paye : %s TND | En attente : %s TND | En retard : %s TND\n"
            + "- Base : %s TND sur %d paiements.",
            tw != null ? " ("+tw.label+")" : "", rate, verdict,
            paid, pending, late, total, pays.size());
    }

    private String answerBudget(Long clubId, String question) {
        List<Budget> budgets = budgetRepo.findByClubId(clubId);
        String q = question.toLowerCase();
        // Filtre par label si mentionne
        List<Budget> filtered = budgets.stream()
            .filter(b -> b.getLabel() != null && q.contains(b.getLabel().toLowerCase().split(" ")[0]))
            .collect(Collectors.toList());
        if (!filtered.isEmpty()) budgets = filtered;

        if (q.contains("depasse") || q.contains("alert")) {
            budgets = budgets.stream().filter(b -> b.getConsumptionPercentage() >= 90).collect(Collectors.toList());
            if (budgets.isEmpty()) return "Aucun budget en alerte (aucun au-dessus de 90% de consommation).";
        }
        if (budgets.isEmpty()) return "Aucun budget configure.";

        StringBuilder sb = new StringBuilder("Situation budgetaire :\n");
        for (Budget b : budgets) {
            int pct = b.getConsumptionPercentage();
            String warn = pct >= 100 ? " DEPASSE" : pct >= 90 ? " ALERTE 90%" : pct >= 75 ? " attention 75%" : "";
            sb.append(String.format("- %s : %s/%s TND (%d%% consomme, reste %s TND)%s\n",
                b.getLabel(), b.getConsumedAmount(), b.getTotalAmount(), pct, b.getRemainingAmount(), warn));
        }
        return sb.toString();
    }

    private String answerExpenses(Long clubId, TimeWindow tw, Expense.ExpenseCategory cat, String q) {
        List<Expense> exps = expenseRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        if (tw != null) exps = exps.stream().filter(e -> e.getCreatedAt()!=null && !e.getCreatedAt().isBefore(tw.since.atStartOfDay())).collect(Collectors.toList());
        if (cat != null) exps = exps.stream().filter(e -> e.getCategory() == cat).collect(Collectors.toList());

        // Filtre par statut si mentionne
        if (q.contains("approuv")) exps = exps.stream().filter(e -> e.getStatus() == Expense.ExpenseStatus.APPROVED).collect(Collectors.toList());
        else if (q.contains("rejet")) exps = exps.stream().filter(e -> e.getStatus() == Expense.ExpenseStatus.REJECTED).collect(Collectors.toList());
        else if (q.contains("attente") || q.contains("pending")) exps = exps.stream().filter(e -> e.getStatus() == Expense.ExpenseStatus.SUBMITTED || e.getStatus() == Expense.ExpenseStatus.VALIDATED).collect(Collectors.toList());

        // Top N (par montant)
        boolean isTop = q.contains("top") || q.contains("plus grosse") || q.contains("plus cher") || q.contains("plus important");
        int topN = 3;
        Matcher mtop = Pattern.compile("top\\s*(\\d+)").matcher(q);
        if (mtop.find()) topN = Integer.parseInt(mtop.group(1));

        if (exps.isEmpty()) {
            return "Aucune depense trouvee" + (tw != null ? " pour " + tw.label : "") + (cat != null ? " en " + cat : "") + ".";
        }

        BigDecimal total = exps.stream().map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalApproved = exps.stream().filter(e -> e.getStatus()==Expense.ExpenseStatus.APPROVED).map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        String contextLabel = (tw != null ? " pour " + tw.label : "") + (cat != null ? " en categorie " + cat : "");

        if (isTop) {
            List<Expense> top = exps.stream()
                .sorted(Comparator.comparing(Expense::getAmount).reversed())
                .limit(topN).collect(Collectors.toList());
            StringBuilder sb = new StringBuilder(String.format("Top %d depense(s)%s :\n", topN, contextLabel));
            int rank = 1;
            for (Expense e : top) {
                sb.append(String.format("%d. %s : %s TND (%s, statut %s)\n",
                    rank++, e.getTitle(), e.getAmount(),
                    e.getCategory() != null ? e.getCategory() : "?", e.getStatus()));
            }
            return sb.toString();
        }

        // Breakdown par statut + par categorie
        Map<Expense.ExpenseStatus, Long> byStatus = exps.stream().collect(Collectors.groupingBy(Expense::getStatus, Collectors.counting()));
        Map<Expense.ExpenseCategory, BigDecimal> byCat = exps.stream()
            .filter(e -> e.getCategory() != null)
            .collect(Collectors.groupingBy(Expense::getCategory,
                Collectors.mapping(Expense::getAmount, Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));

        StringBuilder sb = new StringBuilder(String.format(
            "%d depense(s)%s totalisant %s TND (dont %s TND approuvees).\n",
            exps.size(), contextLabel, total, totalApproved));
        sb.append("Repartition par statut : ");
        byStatus.forEach((s, c) -> sb.append(s).append("=").append(c).append(" "));
        sb.append("\n");
        if (!byCat.isEmpty() && cat == null) {
            sb.append("Par categorie : ");
            byCat.forEach((c, a) -> sb.append(c).append("=").append(a).append(" TND  "));
            sb.append("\n");
        }
        sb.append("Dernieres :\n");
        exps.stream().limit(5).forEach(e -> sb.append(String.format("- %s : %s TND (%s)\n", e.getTitle(), e.getAmount(), e.getStatus())));
        return sb.toString();
    }

    private String answerPayments(Long clubId, TimeWindow tw, User member) {
        List<Payment> pays = paymentRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        if (tw != null) pays = pays.stream().filter(p -> p.getCreatedAt()!=null && !p.getCreatedAt().isBefore(tw.since.atStartOfDay())).collect(Collectors.toList());
        if (member != null) pays = pays.stream().filter(p -> member.getId().equals(p.getMemberId())).collect(Collectors.toList());

        if (pays.isEmpty()) {
            return "Aucun paiement trouve" + (tw != null ? " pour " + tw.label : "") + (member != null ? " pour " + member.getFullName() : "") + ".";
        }
        BigDecimal paid = sumPayments(pays, Payment.PaymentStatus.PAID);
        Map<Payment.PaymentStatus, Long> byStatus = pays.stream().collect(Collectors.groupingBy(Payment::getStatus, Collectors.counting()));
        StringBuilder sb = new StringBuilder();
        sb.append(String.format("%d paiement(s)%s%s : %s TND payes.\n",
            pays.size(),
            member != null ? " pour " + member.getFullName() : "",
            tw != null ? " ("+tw.label+")" : "",
            paid));
        sb.append("Par statut : ");
        byStatus.forEach((s, c) -> sb.append(s).append("=").append(c).append(" "));
        sb.append("\n");
        pays.stream().limit(5).forEach(p -> sb.append(String.format("- %s TND | %s | echeance %s%s\n",
            p.getAmount(), p.getStatus(), p.getDueDate(),
            p.getPaidAt() != null ? " | paye le " + p.getPaidAt().format(DateTimeFormatter.ofPattern("dd/MM")) : "")));
        return sb.toString();
    }

    private String answerRules(Long clubId) {
        var rules = ruleRepo.findByClubIdAndActiveTrue(clubId);
        if (rules.isEmpty()) return "Aucune regle de cotisation active.";
        StringBuilder sb = new StringBuilder(rules.size() + " regle(s) de cotisation active(s) :\n");
        rules.forEach(r -> sb.append(String.format(
            "- %s : %s TND, frequence %s (depuis %s, exemption : %s, echelonnement : %s)\n",
            r.getName(), r.getAmount(), r.getFrequency(), r.getStartDate(),
            r.isAllowExemption() ? "oui" : "non",
            r.isAllowInstallments() ? "oui (max "+r.getMaxInstallments()+")" : "non")));
        return sb.toString();
    }

    private String answerMembers(Long clubId, User mention) {
        List<User> users = userRepo.findByClubId(clubId);
        if (mention != null) {
            List<Payment> pays = paymentRepo.findByClubIdOrderByCreatedAtDesc(clubId).stream()
                .filter(p -> mention.getId().equals(p.getMemberId())).collect(Collectors.toList());
            BigDecimal paid = sumPayments(pays, Payment.PaymentStatus.PAID);
            long lates = pays.stream().filter(p -> p.getStatus() == Payment.PaymentStatus.LATE).count();
            return String.format("%s (%s) - Role %s, email %s\n"
                + "Paiements : %d au total, %s TND payes, %d en retard.",
                mention.getFullName(), mention.getId(), mention.getRole(), mention.getEmail(),
                pays.size(), paid, lates);
        }
        Map<String, Long> byRole = users.stream()
            .collect(Collectors.groupingBy(u -> u.getRole() == null ? "?" : u.getRole().toString(), Collectors.counting()));
        StringBuilder sb = new StringBuilder(users.size() + " membre(s) au total.\n");
        sb.append("Par role : ");
        byRole.forEach((r, c) -> sb.append(r).append("=").append(c).append(" "));
        sb.append("\n");
        users.stream().limit(10).forEach(u -> sb.append(String.format("- %s (%s, %s)\n", u.getFullName(), u.getRole(), u.getEmail())));
        if (users.size() > 10) sb.append("... et ").append(users.size()-10).append(" autres.");
        return sb.toString();
    }

    private String answerAnomalies(Long clubId) {
        List<Payment> pays = paymentRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        List<Budget> budgets = budgetRepo.findByClubId(clubId);
        List<Expense> exps = expenseRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        List<String> anomalies = new ArrayList<>();

        long lateMembers = pays.stream().filter(p -> p.getStatus() == Payment.PaymentStatus.LATE).map(Payment::getMemberId).distinct().count();
        long totalMembers = userRepo.findByClubId(clubId).size();
        if (totalMembers > 0 && (lateMembers * 100 / totalMembers) >= 30) {
            anomalies.add("Taux de retard eleve : " + (lateMembers*100/totalMembers) + "% des membres en retard.");
        }
        budgets.stream().filter(b -> b.getConsumptionPercentage() >= 90).forEach(b ->
            anomalies.add("Budget '" + b.getLabel() + "' consomme a " + b.getConsumptionPercentage() + "%."));
        BigDecimal avgExp = exps.isEmpty() ? BigDecimal.ZERO :
            exps.stream().map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(exps.size()), 2, RoundingMode.HALF_UP);
        exps.stream()
            .filter(e -> e.getAmount().compareTo(avgExp.multiply(BigDecimal.valueOf(3))) > 0)
            .limit(3)
            .forEach(e -> anomalies.add("Depense inhabituelle : '" + e.getTitle() + "' a " + e.getAmount() + " TND (vs moyenne " + avgExp + ")."));

        if (anomalies.isEmpty()) return "Aucune anomalie detectee actuellement. Situation saine.";
        return anomalies.size() + " anomalie(s) detectee(s) :\n- " + String.join("\n- ", anomalies);
    }

    private String answerPredictions(Long clubId) {
        List<Payment> pays = paymentRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        List<Payment> paid = pays.stream().filter(p -> p.getStatus() == Payment.PaymentStatus.PAID && p.getPaidAt() != null).collect(Collectors.toList());
        if (paid.size() < 2) return "Donnees insuffisantes pour une prediction (besoin d'au moins 2 paiements).";

        // Tendance : moyenne mobile 3 mois
        LocalDate today = LocalDate.now();
        BigDecimal last3m = paid.stream()
            .filter(p -> p.getPaidAt().toLocalDate().isAfter(today.minusMonths(3)))
            .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal prev3m = paid.stream()
            .filter(p -> { LocalDate d = p.getPaidAt().toLocalDate(); return d.isAfter(today.minusMonths(6)) && !d.isAfter(today.minusMonths(3)); })
            .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal monthlyAvg = last3m.divide(BigDecimal.valueOf(3), 2, RoundingMode.HALF_UP);
        String trend = last3m.compareTo(prev3m) > 0 ? "en hausse" : last3m.compareTo(prev3m) < 0 ? "en baisse" : "stable";

        List<Expense> apprExps = expenseRepo.findByClubIdOrderByCreatedAtDesc(clubId).stream()
            .filter(e -> e.getStatus() == Expense.ExpenseStatus.APPROVED).collect(Collectors.toList());
        BigDecimal avgExp = apprExps.isEmpty() ? BigDecimal.ZERO :
            apprExps.stream().map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(Math.max(1, apprExps.size())), 2, RoundingMode.HALF_UP);

        return String.format(
            "Prediction (moyenne mobile 3 mois, tendance %s) :\n"
            + "- Revenus moyens : %s TND / mois\n"
            + "- Sur 3 mois : ~%s TND attendus\n"
            + "- Depense moyenne par ticket : %s TND\n"
            + "Une analyse ML plus precise peut etre generee via la page IA & Alertes.",
            trend, monthlyAvg, monthlyAvg.multiply(BigDecimal.valueOf(3)), avgExp);
    }

    private String answerAudit(Long clubId, TimeWindow tw) {
        var logs = auditRepo.findByClubIdOrderByTimestampDesc(clubId);
        if (tw != null) logs = logs.stream().filter(l -> l.getTimestamp() != null && !l.getTimestamp().isBefore(tw.since.atStartOfDay())).collect(Collectors.toList());
        if (logs.isEmpty()) return "Aucune action tracee" + (tw != null ? " pour " + tw.label : "") + ".";
        StringBuilder sb = new StringBuilder(logs.size() + " action(s) tracee(s)" + (tw!=null?" ("+tw.label+")":"") + " :\n");
        logs.stream().limit(15).forEach(l -> sb.append(String.format(
            "- %s | %s | %s #%s | par %s%s\n",
            l.getTimestamp() != null ? l.getTimestamp().format(DateTimeFormatter.ofPattern("dd/MM HH:mm")) : "?",
            l.getAction(), l.getEntityType(), l.getEntityId(),
            l.getActorEmail() != null ? l.getActorEmail() : "?",
            l.getAmount() != null ? " (" + l.getAmount() + " TND)" : "")));
        return sb.toString();
    }

    private String answerNotifications(Long clubId) {
        var notifs = notifRepo.findByClubIdOrderByCreatedAtDesc(clubId);
        if (notifs.isEmpty()) return "Aucune notification.";
        long unread = notifs.stream().filter(n -> !n.isRead()).count();
        StringBuilder sb = new StringBuilder(String.format("%d notification(s), dont %d non lue(s) :\n", notifs.size(), unread));
        notifs.stream().limit(5).forEach(n -> sb.append(String.format("- [%s] %s -> %s\n",
            n.getType(), n.getTitle(), n.getRecipientEmail() != null ? n.getRecipientEmail() : "?")));
        return sb.toString();
    }

    // ========== UTILS ==========

    private BigDecimal sumPayments(List<Payment> pays, Payment.PaymentStatus status) {
        return pays.stream()
            .filter(p -> p.getStatus() == status)
            .map(Payment::getAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
