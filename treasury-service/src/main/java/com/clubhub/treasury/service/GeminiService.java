package com.clubhub.treasury.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:gemini-2.0-flash}")
    private String model;

    @Value("${gemini.max-tokens:2048}")
    private int maxTokens;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank() && !"placeholder".equals(apiKey);
    }

    public String ask(String prompt) {
        if (!isAvailable()) {
            return generateFallbackResponse(prompt);
        }

        try {
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model
                    + ":generateContent?key=" + apiKey;

            Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of(
                            "parts", List.of(Map.of("text", prompt))
                    )),
                    "generationConfig", Map.of(
                            "maxOutputTokens", maxTokens,
                            "temperature", 0.3
                    )
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST,
                    new HttpEntity<>(objectMapper.writeValueAsString(body), headers),
                    String.class
            );

            JsonNode root = objectMapper.readTree(response.getBody());
            return root.at("/candidates/0/content/parts/0/text").asText("Pas de reponse.");

        } catch (Exception e) {
            log.error("Gemini API error: {}", e.getMessage());
            return generateFallbackResponse(prompt);
        }
    }

    /**
     * Version RAG : tente Gemini, en cas d'echec utilise un fallback intelligent
     * base sur la question originale ET le contexte BDD.
     */
    public String askWithFallbackContext(String augmentedPrompt, String originalQuestion, String dbContext) {
        if (!isAvailable()) {
            return buildSmartFallback(originalQuestion, dbContext);
        }
        try {
            String url = String.format(
                    "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
                    model, apiKey);

            Map<String, Object> body = Map.of(
                    "contents", List.of(Map.of(
                            "parts", List.of(Map.of("text", augmentedPrompt))
                    )),
                    "generationConfig", Map.of(
                            "maxOutputTokens", maxTokens,
                            "temperature", 0.3
                    )
            );

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST,
                    new HttpEntity<>(objectMapper.writeValueAsString(body), headers),
                    String.class
            );

            JsonNode root = objectMapper.readTree(response.getBody());
            return root.at("/candidates/0/content/parts/0/text").asText("Pas de reponse.");

        } catch (Exception e) {
            log.error("Gemini API error (RAG): {}", e.getMessage().substring(0, Math.min(200, e.getMessage().length())));
            return buildSmartFallback(originalQuestion, dbContext);
        }
    }

    /**
     * Fallback intelligent (sans LLM) : analyse la question et produit
     * une reponse naturelle a partir des vraies donnees BDD extraites par le RAG.
     * Objectif : reponses aussi utiles que Gemini, SANS dependance externe.
     */
    private String buildSmartFallback(String question, String dbContext) {
        String q = question.toLowerCase();
        Map<String, String> kpi = parseKpisFromContext(dbContext);

        String collected = kpi.getOrDefault("Total collecte", "0");
        String pending = kpi.getOrDefault("Total en attente", "0");
        String late = kpi.getOrDefault("Total en retard", "0");
        String recovery = kpi.getOrDefault("Taux de recouvrement", "0");
        String membersUp = kpi.getOrDefault("Membres a jour", "0");
        String membersLate = kpi.getOrDefault("Membres en retard", "0");
        String totalMembers = kpi.getOrDefault("Total membres", "0");
        String totalPayments = kpi.getOrDefault("Nombre total de paiements", "0");
        String totalExpenses = kpi.getOrDefault("Nombre total de depenses", "0");

        // Reponses specifiques par intention
        if (q.contains("retard") || q.contains("impaye") || q.contains("relance")) {
            String membresEnRetardDetail = extractSection(dbContext, "[MEMBRES EN RETARD]");
            return String.format(
                "Actuellement, %s membre(s) sont en retard de paiement pour un montant total de %s TND. "
                + "Le taux de recouvrement du club est de %s%%.%s",
                membersLate, late, recovery,
                membresEnRetardDetail.isBlank() ? "" : "\n\nDetail :\n" + membresEnRetardDetail);
        }

        if (q.contains("budget") || q.contains("consomm") || q.contains("restant") || q.contains("depasse")) {
            String budgetsDetail = extractSection(dbContext, "[BUDGETS]");
            return String.format(
                "Voici la situation budgetaire du club :\n%s\n"
                + "(Total depense approuve : %s depenses actives)",
                budgetsDetail.isBlank() ? "Aucun budget configure." : budgetsDetail,
                totalExpenses);
        }

        if (q.contains("depense") || q.contains("facture") || q.contains("rembours") || q.contains("approuv")) {
            String depensesDetail = extractSection(dbContext, "[DEPENSES]");
            return String.format(
                "Voici le resume des depenses du club :\n%s",
                depensesDetail.isBlank() ? "Aucune depense enregistree." : depensesDetail);
        }

        if (q.contains("recouvrement") || q.contains("taux") || q.contains("performance")) {
            return String.format(
                "Le taux de recouvrement actuel est de %s%%. "
                + "Sur %s paiements enregistres, le club a collecte %s TND, avec %s TND en attente et %s TND en retard. "
                + "%s membres sont a jour sur %s au total.",
                recovery, totalPayments, collected, pending, late, membersUp, totalMembers);
        }

        if (q.contains("paiement") || q.contains("paye") || q.contains("collecte")) {
            String paiementsDetail = extractSection(dbContext, "[PAIEMENTS");
            return String.format(
                "Le club a enregistre %s paiements pour un total collecte de %s TND.\n%s",
                totalPayments, collected,
                paiementsDetail.isBlank() ? "" : paiementsDetail);
        }

        if (q.contains("cotisation") || q.contains("regle") || q.contains("frequence")) {
            String reglesDetail = extractSection(dbContext, "[REGLES DE COTISATION");
            return reglesDetail.isBlank()
                ? "Aucune regle de cotisation active actuellement."
                : "Regles de cotisation actives :\n" + reglesDetail;
        }

        if (q.contains("membre") || q.contains("utilisateur")) {
            return String.format(
                "Le club compte %s membres : %s a jour sur leurs cotisations et %s en retard. "
                + "Nombre total de paiements enregistres : %s.",
                totalMembers, membersUp, membersLate, totalPayments);
        }

        if (q.contains("audit") || q.contains("historique") || q.contains("trace") || q.contains("log")) {
            String auditDetail = extractSection(dbContext, "[JOURNAL D'AUDIT");
            return auditDetail.isBlank()
                ? "Aucune action recente dans le journal d'audit."
                : "Dernieres actions tracees :\n" + auditDetail;
        }

        if (q.contains("notification") || q.contains("email") || q.contains("alerte")) {
            String notifDetail = extractSection(dbContext, "[NOTIFICATIONS");
            return notifDetail.isBlank()
                ? "Aucune notification recente."
                : "Notifications recentes :\n" + notifDetail;
        }

        if (q.contains("anomalie") || q.contains("suspect") || q.contains("fraude")) {
            int latePct = 0;
            try {
                double c = Double.parseDouble(collected.replace(",", "."));
                double l = Double.parseDouble(late.replace(",", "."));
                if (c + l > 0) latePct = (int) ((l / (c + l)) * 100);
            } catch (Exception ignored) {}
            return String.format(
                "Analyse de la situation : %s%% des montants sont en retard. "
                + "%s membres en retard sur %s (%s %% de la base). "
                + (latePct > 20 || (Integer.parseInt(totalMembers) > 0 && Integer.parseInt(membersLate) * 100 / Math.max(1, Integer.parseInt(totalMembers)) > 30)
                    ? "Situation a surveiller : taux de retard eleve."
                    : "Aucune anomalie critique detectee."),
                latePct, membersLate, totalMembers,
                Integer.parseInt(totalMembers) > 0 ? Integer.parseInt(membersLate) * 100 / Integer.parseInt(totalMembers) : 0);
        }

        if (q.contains("prediction") || q.contains("prevision") || q.contains("futur") || q.contains("prochain")) {
            return String.format(
                "Estimations basees sur les donnees actuelles :\n"
                + "- Revenus moyens par paiement : %s TND / paiement (sur %s paiements)\n"
                + "- Montant total en attente : %s TND\n"
                + "- Si le taux de recouvrement actuel (%s%%) se maintient, environ %s TND supplementaires seront collectes.\n"
                + "Une analyse predictive detaillee est disponible dans la page IA & Alertes.",
                safeDivide(collected, totalPayments), totalPayments, pending, recovery,
                safeMultiply(pending, recovery, 100));
        }

        if (q.contains("resume") || q.contains("situation") || q.contains("general") || q.contains("etat")
            || q.contains("bonjour") || q.contains("salut") || q.contains("hello") || q.isBlank()) {
            return String.format(
                "Bonjour ! Voici la situation financiere du club :\n"
                + "- Collecte : %s TND (%s paiements)\n"
                + "- En attente : %s TND | En retard : %s TND\n"
                + "- Taux de recouvrement : %s%%\n"
                + "- Membres : %s a jour / %s en retard (total %s)\n"
                + "- Depenses : %s enregistrees\n"
                + "Que voulez-vous savoir de plus ? (retards, budget, depenses, cotisations...)",
                collected, totalPayments, pending, late, recovery,
                membersUp, membersLate, totalMembers, totalExpenses);
        }

        // Par defaut : KPI synthetique + encouragement a preciser
        return String.format(
            "Je n'ai pas de reponse specifique a cette question, mais voici un apercu du club :\n"
            + "- %s TND collectes, %s TND en attente, %s TND en retard\n"
            + "- Taux de recouvrement : %s%% | %s membres en retard\n"
            + "Essayez de demander : 'paiements en retard', 'budget', 'depenses', 'cotisations', 'membres', 'anomalies' ou 'prediction'.",
            collected, pending, late, recovery, membersLate);
    }

    /** Extrait les KPI du bloc [STATISTIQUES GENERALES] en paires cle->valeur */
    private Map<String, String> parseKpisFromContext(String ctx) {
        Map<String, String> out = new HashMap<>();
        boolean inStats = false;
        for (String raw : ctx.split("\n")) {
            String line = raw.trim();
            if (line.startsWith("[STATISTIQUES")) { inStats = true; continue; }
            if (line.startsWith("[") && inStats) break;
            if (!inStats || !line.startsWith("- ")) continue;

            String body = line.substring(2);
            int colon = body.indexOf(':');
            if (colon < 0) continue;
            String key = body.substring(0, colon).trim();
            String val = body.substring(colon + 1).trim();

            // "Membres a jour: 5 / Membres en retard: 2 / Total membres: 8"
            if (val.contains(" / ")) {
                out.put("Membres a jour", val.split("/")[0].trim());
                for (String seg : val.split(" / ")) {
                    int c = seg.indexOf(':');
                    if (c > 0) out.put(seg.substring(0, c).trim(), seg.substring(c + 1).trim().replace(" TND", ""));
                }
            } else {
                out.put(key, val.replace(" TND", "").replace("%", "").trim());
            }
        }
        return out;
    }

    /** Retourne le contenu textuel d'une section (entre un marqueur et le prochain marqueur [...]) */
    private String extractSection(String ctx, String marker) {
        StringBuilder sb = new StringBuilder();
        boolean capturing = false;
        for (String line : ctx.split("\n")) {
            String t = line.trim();
            if (t.startsWith(marker)) { capturing = true; continue; }
            if (capturing && t.startsWith("[") && !t.startsWith(marker)) break;
            if (capturing && !t.isEmpty()) sb.append(t).append("\n");
        }
        return sb.toString().trim();
    }

    private String safeDivide(String a, String b) {
        try {
            double x = Double.parseDouble(a.replace(",", "."));
            double y = Double.parseDouble(b.replace(",", "."));
            return y == 0 ? "0" : String.format("%.2f", x / y);
        } catch (Exception e) { return "0"; }
    }

    private String safeMultiply(String a, String b, double divisor) {
        try {
            double x = Double.parseDouble(a.replace(",", "."));
            double y = Double.parseDouble(b.replace(",", "."));
            return String.format("%.0f", x * y / divisor);
        } catch (Exception e) { return "0"; }
    }

    public String categorizeExpense(String title, String description) {
        String prompt = """
                Tu es un assistant financier pour un club universitaire tunisien.
                Categorise cette depense dans UNE des categories suivantes:
                FOURNITURES, TRANSPORT, HEBERGEMENT, RESTAURATION, MATERIEL, COMMUNICATION, EVENEMENT, AUTRE

                Titre: %s
                Description: %s

                Reponds UNIQUEMENT au format JSON:
                {"category": "CATEGORIE", "confidence": 85, "reason": "explication courte"}
                """.formatted(title, description != null ? description : "");

        return ask(prompt);
    }

    public String chatTreasury(String question, String financialContext) {
        String prompt = """
                Tu es l'assistant IA tresorerie de ClubHub, une plateforme de gestion de clubs universitaires tunisiens.
                La devise est le TND (Dinar Tunisien).

                Contexte financier du club:
                %s

                Question du membre: %s

                Reponds de maniere concise et utile en francais. Si tu ne connais pas la reponse exacte,
                donne des conseils generaux bases sur le contexte fourni.
                """.formatted(financialContext, question);

        return ask(prompt);
    }

    public String analyzeBudgetTrend(String historicalData) {
        String prompt = """
                Tu es un analyste financier IA pour un club universitaire tunisien (devise: TND).

                Donnees historiques des transactions:
                %s

                Analyse les tendances et fournis:
                1. Prediction des revenus pour les 3 prochains mois
                2. Prediction des depenses pour les 3 prochains mois
                3. Alertes si un deficit est prevu
                4. Recommandations

                Reponds au format JSON:
                {
                  "predictions": [
                    {"month": "Mai 2026", "predictedRevenue": 800, "predictedExpenses": 600, "balance": 200, "confidence": 75, "trend": "STABLE"}
                  ],
                  "alerts": ["alerte 1"],
                  "recommendations": ["recommandation 1"]
                }
                """.formatted(historicalData);

        return ask(prompt);
    }

    private String generateFallbackResponse(String prompt) {
        String lower = prompt.toLowerCase();

        if (lower.contains("categori")) {
            return classifyByKeywords(lower);
        }
        if (lower.contains("prediction") || lower.contains("tendance") || lower.contains("trend")) {
            return """
                    {"predictions": [
                      {"month": "Mai 2026", "predictedRevenue": 750, "predictedExpenses": 500, "balance": 250, "confidence": 60, "trend": "STABLE"},
                      {"month": "Juin 2026", "predictedRevenue": 700, "predictedExpenses": 450, "balance": 250, "confidence": 55, "trend": "STABLE"},
                      {"month": "Juil 2026", "predictedRevenue": 400, "predictedExpenses": 300, "balance": 100, "confidence": 50, "trend": "DOWN"}
                    ],
                    "alerts": ["Baisse prevue en periode estivale (juillet)"],
                    "recommendations": ["Planifier les cotisations avant la periode creuse", "Reduire les depenses non essentielles en ete"]}
                    """;
        }
        if (lower.contains("taux") || lower.contains("recouvrement")) {
            return "Le taux de recouvrement represente le pourcentage des cotisations effectivement payees par rapport au total attendu. Un bon taux est superieur a 80%.";
        }
        if (lower.contains("retard")) {
            return "Les membres en retard sont ceux dont le paiement depasse la date d'echeance sans avoir ete regle. Le systeme les marque automatiquement comme LATE chaque jour a 8h00.";
        }
        if (lower.contains("budget")) {
            return "Le budget est suivi en temps reel. Des alertes sont declenchees a 50%, 75%, 90% et 100% de consommation pour prevenir les depassements.";
        }

        return "Je suis l'assistant IA tresorerie de ClubHub. Je peux vous aider avec les cotisations, depenses, budgets, et rapports financiers. (Mode fallback - configurez GEMINI_API_KEY pour des reponses completes)";
    }

    /**
     * Classification par mots-cles — fallback intelligent quand Gemini est indisponible.
     * Score base sur le nombre de mots-cles matches dans titre+description.
     */
    private String classifyByKeywords(String prompt) {
        // Extraction du titre+description du prompt UNIQUEMENT.
        // Sinon les mots-cles TRANSPORT/HEBERGEMENT/etc. presents dans la
        // liste des categories du prompt fausseraient la classification.
        String text;
        int titreIdx = prompt.toLowerCase().indexOf("titre:");
        int repondsIdx = prompt.toLowerCase().indexOf("reponds");
        if (titreIdx >= 0 && repondsIdx > titreIdx) {
            text = prompt.substring(titreIdx, repondsIdx).toLowerCase();
        } else {
            text = prompt.toLowerCase();
        }

        Map<String, String[]> keywords = new java.util.LinkedHashMap<>();
        keywords.put("TRANSPORT", new String[]{"bus", "taxi", "train", "essence", "voiture", "minibus", "deplacement", "billet", "transport", "tgv", "carburant"});
        keywords.put("HEBERGEMENT", new String[]{"hotel", "auberge", "residence", "nuit", "chambre", "logement", "hebergement", "appartement"});
        keywords.put("RESTAURATION", new String[]{"buffet", "repas", "dejeuner", "diner", "cafe", "traiteur", "viennoiserie", "snack", "restaurant", "restauration", "boisson", "gateau", "pizza"});
        keywords.put("EVENEMENT", new String[]{"gala", "soiree", "hackathon", "conference", "journee", "integration", "ceremonie", "festival", "anniversaire"});
        keywords.put("MATERIEL", new String[]{"table", "chaise", "ecran", "sono", "banderole", "decoration", "equipement", "ordinateur", "video", "projecteur", "kit", "materiel"});
        keywords.put("COMMUNICATION", new String[]{"flyer", "affiche", "banniere", "post", "emailing", "publicite", "pub", "campagne", "communication", "marketing", "linkedin"});
        keywords.put("FOURNITURES", new String[]{"papeterie", "stylo", "cahier", "classeur", "cartouche", "bureau", "fourniture", "papier", "encre", "consommable"});

        String bestCategory = "AUTRE";
        int bestScore = 0;
        for (Map.Entry<String, String[]> e : keywords.entrySet()) {
            int score = 0;
            for (String kw : e.getValue()) {
                if (text.contains(kw)) score++;
            }
            if (score > bestScore) {
                bestScore = score;
                bestCategory = e.getKey();
            }
        }

        int confidence;
        String reason;
        if (bestScore == 0) {
            confidence = 40;
            reason = "Aucun mot-cle reconnu (classification par defaut)";
        } else if (bestScore == 1) {
            confidence = 70;
            reason = "1 mot-cle " + bestCategory.toLowerCase() + " detecte";
        } else {
            confidence = 85;
            reason = bestScore + " mots-cles " + bestCategory.toLowerCase() + " detectes";
        }

        return String.format("{\"category\": \"%s\", \"confidence\": %d, \"reason\": \"%s\"}",
                bestCategory, confidence, reason);
    }
}
