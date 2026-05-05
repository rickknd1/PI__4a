package tn.esprit.clubhub.Service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tn.esprit.clubhub.Entity.Event;
import tn.esprit.clubhub.Entity.MeetingPv;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Turns a free-form Q&A (in any language: French / English / Arabic / Tunisian
 * darija / a mix) into a polished, professionally-worded French PV.
 *
 * <p>The PV follows a standard 5-section template that hierarchical bodies
 * recognise: <em>Préambule, Déroulement, Décisions, Plan d'action, Clôture</em>.
 * The LLM is instructed never to invent facts — anything not covered by the
 * answers OR by the real event context (RSVPs, tasks, feedback…) must be
 * marked {@code "Non précisé"} so the secretary can edit it before saving.</p>
 *
 * <p>If the LLM is disabled or fails, we fall back to a deterministic
 * template-based PV so the secretary still gets a usable starting point.</p>
 */
@Slf4j
@Service
public class PvAiService {

    // Injected via the @Primary AiClientRouter → LocalAiClient (Ollama).
    // 100% local stack — no third-party LLM.
    @Autowired private AiClient llm;
    // Direct handle on the Python service — used for the CUSTOM rule-based
    // NLP PV builder (no prompt, typed inputs). Preferred over the LLM
    // when available because it's deterministic, reproducible, and ours.
    @Autowired private LocalAiClient localAi;
    @Autowired private EventContextService contextService;

    /**
     * Generates the PV body for the given event + secretary answers.
     *
     * Preference order (always returns a non-null, usable draft):
     *   1. Custom rule-based NLP builder (Python service). Fully offline,
     *      no LLM, no hallucination.
     *   2. LLM path (local Ollama, via AiClientRouter).
     *   3. Built-in Java deterministic template.
     *
     * @param event the event being documented (provides title, date, location)
     * @param qaPairs the secretary's answers (Y/N + free text, any language)
     * @param additionalNotes free-form extras the secretary typed below the form
     * @return the formatted PV body, ready to be shown in the editable preview
     */
    public String generate(Event event,
                           List<MeetingPv.QaPair> qaPairs,
                           String additionalNotes) {

        Map<String, Object> ctx = contextService.buildContext(event);

        // ── 1) Custom in-house rule-based NLP PV builder ─────────────
        if (localAi != null && localAi.isEnabled()) {
            try {
                List<Map<String, Object>> wireQa = toWireQa(qaPairs);
                String customPv = localAi.buildPvFromContext(ctx, wireQa, additionalNotes);
                if (customPv != null && !customPv.isBlank()) {
                    log.info("PvAiService: generated with custom rule-based NLP builder.");
                    return customPv;
                }
            } catch (Exception e) {
                log.warn("PvAiService: custom PV builder failed ({}). Trying LLM.",
                        e.getMessage());
            }
        }

        // ── 2) LLM path ──────────────────────────────────────────────
        if (!llm.isEnabled()) {
            log.warn("PvAiService: LLM disabled — falling back to built-in template");
            return fallbackTemplate(event, ctx, qaPairs, additionalNotes);
        }
        try {
            return llm.generateText(buildPrompt(event, ctx, qaPairs, additionalNotes));
        } catch (Exception e) {
            log.warn("PvAiService: LLM call failed ({}). Falling back to template.",
                    e.getMessage());
            return fallbackTemplate(event, ctx, qaPairs, additionalNotes);
        }
    }

    /**
     * Transforms the internal QaPair objects into the wire shape the Python
     * service expects (plain maps, JSON-serialisable).
     */
    private List<Map<String, Object>> toWireQa(List<MeetingPv.QaPair> qaPairs) {
        if (qaPairs == null) return List.of();
        return qaPairs.stream().map(p -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("section", p.getSection());
            m.put("question", p.getQuestion());
            m.put("answer", p.getAnswer());
            m.put("explanation", p.getExplanation());
            m.put("type", p.getType());
            return m;
        }).toList();
    }

    // ── Prompt engineering ──────────────────────────────────────────────────

    private String buildPrompt(Event event,
                               Map<String, Object> ctx,
                               List<MeetingPv.QaPair> qaPairs,
                               String additionalNotes) {

        String title = strOr(ctx.get("title"), "Événement");
        String start = strOr(ctx.get("startDate"), "Date non précisée");
        String end   = strOr(ctx.get("endDate"), "—");
        String location = mapStr(ctx.get("location"), "name", "Lieu non précisé");
        String address  = mapStr(ctx.get("location"), "address", "");

        // ── Real numbers (the LLM MUST reuse them verbatim) ──────────────
        Map<String, Object> att   = mapOrEmpty(ctx.get("attendance"));
        Map<String, Object> tasks = mapOrEmpty(ctx.get("tasks"));
        Map<String, Object> bor   = mapOrEmpty(ctx.get("borrowedItems"));
        Map<String, Object> fb    = mapOrEmpty(ctx.get("feedback"));

        String staffBlock = formatStaff(ctx.get("staff"));
        String tagsBlock  = formatTags(fb.get("topTags"));
        String commentsBlock = formatComments(fb.get("comments"));
        String taskHighlights = formatTaskHighlights(tasks.get("highlights"));
        String borrowedBlock = formatBorrowed(bor.get("items"));

        // ── Split answers per PV section so the prompt is ordered the
        //    same way the final document will read.
        String preambuleBlock   = sectionBlock(qaPairs, "préambule");
        String deroulementBlock = sectionBlock(qaPairs, "déroulement");
        String decisionsBlock   = sectionBlock(qaPairs, "décisions");
        String planBlock        = sectionBlock(qaPairs, "plan d'action");
        String clotureBlock     = sectionBlock(qaPairs, "clôture");
        String unsectionedBlock = sectionBlock(qaPairs, null);

        String notesBlock = (additionalNotes == null || additionalNotes.isBlank())
                ? "(aucune)"
                : additionalNotes.trim();

        return """
            Tu es le Secrétaire Général d'un club étudiant. Ton rôle est de
            rédiger un BROUILLON de Procès-Verbal (PV) en FRANÇAIS FORMEL à
            partir des DONNÉES RÉELLES de l'événement (chiffres mesurés en
            base) et des réponses du secrétaire. Les réponses peuvent être
            en français, anglais, arabe ou en tunisien (darija) — traduis-les
            et reformule-les dans un style administratif neutre.

            RÈGLES STRICTES:
            • Reprends TEXTUELLEMENT les chiffres réels (présence, taux,
              tâches, notes de feedback). Ne les arrondis pas, ne les
              modifies pas.
            • Pour chaque question OUI/NON :
                – Si la réponse est « OUI » : reformule la chose comme une
                  affirmation positive intégrée à la narration (ex.
                  "agenda_respected=oui" → « Le programme prévu a été
                  intégralement respecté. »).
                – Si la réponse est « NON » et qu'une EXPLICATION est
                  fournie, reprends-la TEXTUELLEMENT (en la traduisant si
                  nécessaire) plutôt que d'inventer une cause.
                – Si la réponse est « NON » sans explication, indique
                  simplement le fait au passif (« n'a pas été respecté »,
                  « n'a pas pu être tenu »…) sans en deviner la raison.
                – Si la réponse est « SANS AVIS » ou absente, n'écris
                  rien sur ce point.
            • Respecte STRICTEMENT l'ordre des sections du PV (Préambule,
              Déroulement, Décisions, Plan d'action, Clôture) ; chaque
              réponse doit apparaître dans la section où elle est listée.
            • N'invente AUCUN fait absent du contexte ou des réponses. Si
              une information manque, écris « Non précisé ».
            • Pas de listes à puces sans verbe — privilégie des phrases
              complètes et professionnelles.
            • Reste objectif, pas de superlatifs ni d'opinions personnelles.
            • Le PV doit pouvoir être imprimé et signé tel quel.

            STRUCTURE OBLIGATOIRE (utilise ces titres exactement) :

            === PRÉAMBULE ===
            (1 paragraphe : titre, date/horaire, lieu+adresse, format ;
            intègre les réponses Préambule du secrétaire)

            === DÉROULEMENT ===
            (2-3 paragraphes : qui a animé/encadré, programme, fréquentation
            avec les CHIFFRES RÉELS — confirmés / présents / no-shows / taux,
            ambiance ; intègre les réponses Déroulement du secrétaire,
            y compris les incidents éventuels)

            === DÉCISIONS ===
            (Énumère les décisions actées telles que listées par le
            secrétaire ; si aucune, écris « Aucune décision formelle prise. »)

            === PLAN D'ACTION ===
            (Tableau textuel : Action — Responsable — Échéance, basé sur
            les tâches du système et les actions de suivi listées ; sinon
            « Aucune action de suivi assignée. »)

            === CLÔTURE ===
            (1 court paragraphe : bilan synthétique appuyé sur la note
            moyenne et les commentaires participants, respect du budget,
            restitution du matériel, recommandation éventuelle de
            reconduire l'événement)

            ─────────── DONNÉES DE L'ÉVÉNEMENT ───────────
            Titre        : %s
            Début        : %s
            Fin          : %s
            Lieu         : %s
            Adresse      : %s
            Format       : %s
            Capacité     : %s

            ─────────── ÉQUIPE ENCADRANTE ───────────
            %s

            ─────────── FRÉQUENTATION (chiffres réels) ───────────
            • RSVPs confirmés        : %s
            • Présents (check-in)    : %s
            • No-shows               : %s
            • Total RSVPs            : %s
            • Taux de remplissage    : %s %%
            • Taux de présence       : %s %%

            ─────────── TÂCHES ───────────
            Total %s — Terminées %s — En cours %s — À faire %s
            (Succès %s, Partielles %s, Sautées %s, Taux d'achèvement %s %%)
            Faits marquants :
            %s

            ─────────── MATÉRIEL EMPRUNTÉ ───────────
            %s articles
            %s

            ─────────── RETOURS PARTICIPANTS (feedback) ───────────
            Nombre de retours : %s
            Notes moyennes (1-5) — Organisation %s • Contenu %s • Animation %s • Lieu %s • Planning %s
            Recommandation (NPS, 0-10) : %s
            Tags fréquents : %s
            Extraits de commentaires :
            %s

            ─────────── RÉPONSES — PRÉAMBULE ───────────
            %s

            ─────────── RÉPONSES — DÉROULEMENT ───────────
            %s

            ─────────── RÉPONSES — DÉCISIONS ───────────
            %s

            ─────────── RÉPONSES — PLAN D'ACTION ───────────
            %s

            ─────────── RÉPONSES — CLÔTURE ───────────
            %s

            ─────────── AUTRES RÉPONSES (sans section) ───────────
            %s

            ─────────── NOTES COMPLÉMENTAIRES ───────────
            %s

            Maintenant rédige le PV. Réponds UNIQUEMENT avec le contenu du PV
            (commence directement par « === PRÉAMBULE === »), sans introduction
            ni commentaire de ta part.
            """.formatted(
                title, start, end, location, address,
                strOr(ctx.get("format"), "Non précisé"),
                strOr(ctx.get("capacity"), "0"),
                staffBlock,
                strOr(att.get("confirmed"), "0"),
                strOr(att.get("checkedIn"), "0"),
                strOr(att.get("noShows"), "0"),
                strOr(att.get("totalRsvps"), "0"),
                strOr(att.get("fillRatePct"), "0"),
                strOr(att.get("attendanceRatePct"), "0"),
                strOr(tasks.get("total"), "0"),
                strOr(tasks.get("done"), "0"),
                strOr(tasks.get("inProgress"), "0"),
                strOr(tasks.get("todo"), "0"),
                strOr(tasks.get("success"), "0"),
                strOr(tasks.get("partial"), "0"),
                strOr(tasks.get("skipped"), "0"),
                strOr(tasks.get("completionRatePct"), "0"),
                taskHighlights.isBlank() ? "  (aucun)" : taskHighlights,
                strOr(bor.get("count"), "0"),
                borrowedBlock.isBlank() ? "  (aucun)" : borrowedBlock,
                strOr(fb.get("count"), "0"),
                strOr(fb.get("avgOrganization"), "0"),
                strOr(fb.get("avgContent"), "0"),
                strOr(fb.get("avgAnimation"), "0"),
                strOr(fb.get("avgVenue"), "0"),
                strOr(fb.get("avgSchedule"), "0"),
                strOr(fb.get("avgNps"), "0"),
                tagsBlock.isBlank() ? "(aucun)" : tagsBlock,
                commentsBlock.isBlank() ? "  (aucun)" : commentsBlock,
                preambuleBlock.isBlank()   ? "  (aucune)" : preambuleBlock,
                deroulementBlock.isBlank() ? "  (aucune)" : deroulementBlock,
                decisionsBlock.isBlank()   ? "  (aucune)" : decisionsBlock,
                planBlock.isBlank()        ? "  (aucune)" : planBlock,
                clotureBlock.isBlank()     ? "  (aucune)" : clotureBlock,
                unsectionedBlock.isBlank() ? "  (aucune)" : unsectionedBlock,
                notesBlock
        );
    }

    /**
     * Format every answered question of a given section in a way the LLM
     * can re-use directly. Y/N questions are tagged with their answer (and
     * the secretary's free-text explanation when the answer is "non"); free-
     * text questions are kept as-is.
     */
    private String sectionBlock(List<MeetingPv.QaPair> qaPairs, String section) {
        if (qaPairs == null) return "";
        return qaPairs.stream()
                .filter(p -> sectionMatches(p.getSection(), section))
                .filter(p -> {
                    String a = p.getAnswer();
                    String e = p.getExplanation();
                    return (a != null && !a.isBlank()) || (e != null && !e.isBlank());
                })
                .map(this::formatPair)
                .collect(Collectors.joining("\n"));
    }

    private static boolean sectionMatches(String pairSection, String wanted) {
        if (wanted == null) {
            return pairSection == null || pairSection.isBlank();
        }
        return pairSection != null && pairSection.equalsIgnoreCase(wanted);
    }

    private String formatPair(MeetingPv.QaPair p) {
        String q = p.getQuestion();
        String a = p.getAnswer() == null ? "" : p.getAnswer().trim();
        String e = p.getExplanation() == null ? "" : p.getExplanation().trim();

        if ("yesno".equalsIgnoreCase(p.getType())) {
            String upper = a.toUpperCase();
            if ("NON".equals(upper) && !e.isEmpty()) {
                return "  • " + q + " → NON\n     ↳ Explication du secrétaire (à reprendre verbatim) : "
                        + e;
            }
            return "  • " + q + " → " + (upper.isEmpty() ? "—" : upper);
        }
        return "  • " + q + "\n     ↳ " + a;
    }

    // ── Formatting helpers used by the prompt ────────────────────────────

    @SuppressWarnings("unchecked")
    private String formatStaff(Object raw) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) return "  (non précisé)";
        return ((List<Map<String, Object>>) list).stream()
                .map(m -> "  • " + strOr(m.get("name"), "—") + " — " + strOr(m.get("role"), "rôle non précisé"))
                .collect(Collectors.joining("\n"));
    }

    @SuppressWarnings("unchecked")
    private String formatTags(Object raw) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) return "(aucun)";
        return ((List<Map<String, Object>>) list).stream()
                .map(m -> strOr(m.get("tag"), "?") + " (" + strOr(m.get("count"), "0") + ")")
                .collect(Collectors.joining(", "));
    }

    @SuppressWarnings("unchecked")
    private String formatComments(Object raw) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) return "  (aucun)";
        return ((List<String>) list).stream()
                .map(c -> "  • « " + c + " »")
                .collect(Collectors.joining("\n"));
    }

    @SuppressWarnings("unchecked")
    private String formatTaskHighlights(Object raw) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) return "  (aucun)";
        return ((List<Map<String, Object>>) list).stream()
                .map(m -> "  • " + strOr(m.get("title"), "—")
                        + " (" + strOr(m.get("assignee"), "—") + ", "
                        + strOr(m.get("outcome"), "—") + ") : "
                        + strOr(m.get("note"), ""))
                .collect(Collectors.joining("\n"));
    }

    @SuppressWarnings("unchecked")
    private String formatBorrowed(Object raw) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) return "  (aucun)";
        return ((List<Map<String, Object>>) list).stream()
                .map(m -> "  • " + strOr(m.get("name"), "—")
                        + " (prêteur : " + strOr(m.get("lender"), "—")
                        + ", statut : " + strOr(m.get("status"), "—") + ")")
                .collect(Collectors.joining("\n"));
    }

    private String reformulate(String id, String answer, String explanation) {
        if (id == null) return null;
        boolean yes = "Oui".equalsIgnoreCase(answer) || "Yes".equalsIgnoreCase(answer);
        String extra = (explanation != null && !explanation.isBlank()) ? " (" + explanation.trim() + ")" : "";

        return switch (id) {
            case "started_on_time" -> yes 
                ? "L'événement a débuté conformément à l'horaire prévu." 
                : "L'horaire de démarrage a été ajusté par rapport aux prévisions initiales." + extra;
            case "venue_ok" -> yes 
                ? "La logistique s'est déroulée dans le lieu initialement réservé." 
                : "Le lieu de l'événement a été modifié pour répondre aux besoins d'organisation." + extra;
            case "staff_complete" -> yes 
                ? "L'équipe d'encadrement était présente pour assurer le déroulement." 
                : "L'organisation de l'équipe a été adaptée par rapport à la planification." + extra;
            case "agenda_respected" -> yes 
                ? "Le programme prévisionnel a été suivi selon l'ordre du jour établi." 
                : "Le déroulement de la séance a évolué par rapport au programme initial." + extra;
            case "atmosphere_positive" -> yes 
                ? "Une atmosphère positive a régné tout au long des échanges." 
                : "La séance a été marquée par des échanges riches et variés." + extra;
            case "decisions_taken" -> yes 
                ? "La session a permis d'aboutir à des décisions concrètes." 
                : "Les points abordés restent en cours de réflexion pour des décisions ultérieures.";
            case "tasks_completed" -> yes 
                ? "Les objectifs opérationnels fixés ont été atteints." 
                : "Le suivi des actions se poursuit au-delà de cet événement." + extra;
            case "budget_respected" -> yes 
                ? "La gestion financière est restée dans l'enveloppe budgétaire allouée." 
                : "Le bilan financier définitif sera consolidé prochainement." + extra;
            case "will_repeat" -> yes 
                ? "Il est recommandé de reconduire ce format d'événement." 
                : "Une analyse approfondie sera menée avant d'envisager une future édition.";
            default -> null;
        };
    }

    private static String strOr(Object o, String fallback) {
        if (o == null) return fallback;
        String s = String.valueOf(o);
        return s.isBlank() ? fallback : s;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> mapOrEmpty(Object o) {
        return o instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
    }

    private static String mapStr(Object o, String key, String fallback) {
        if (!(o instanceof Map<?, ?> m)) return fallback;
        Object v = m.get(key);
        if (v == null) return fallback;
        String s = v.toString();
        return s.isBlank() ? fallback : s;
    }

    // ── Fallback (no LLM) ───────────────────────────────────────────────────

    private String fallbackTemplate(Event event,
                                    Map<String, Object> ctx,
                                    List<MeetingPv.QaPair> qaPairs,
                                    String additionalNotes) {

        String title = event != null && event.getTitle() != null
                ? event.getTitle() : "l'événement";
        String date  = event != null && event.getStartDate() != null
                ? event.getStartDate().format(DateTimeFormatter.ofPattern("dd MMMM yyyy"))
                : "Date non précisée";
        String location = event != null && event.getLocation() != null
                && event.getLocation().getName() != null
                ? event.getLocation().getName()
                : "Lieu non précisé";

        Map<String, Object> att = mapOrEmpty(ctx.get("attendance"));
        Map<String, Object> tasks = mapOrEmpty(ctx.get("tasks"));
        Map<String, Object> fb = mapOrEmpty(ctx.get("feedback"));

        StringBuilder body = new StringBuilder();
        body.append("=== PRÉAMBULE ===\n")
            .append("Le présent procès-verbal documente le déroulement de l'événement « ")
            .append(title).append(" » qui s'est tenu le ").append(date)
            .append(" à ").append(location).append(".\n\n");

        body.append("=== DÉROULEMENT ===\n")
            .append(generateAttendanceInsight(att)).append("\n");
        
        if (qaPairs != null) {
            for (MeetingPv.QaPair p : qaPairs) {
                String ans = p.getAnswer();
                if (ans == null || ans.isBlank()) continue;
                
                String reformulated = reformulate(p.getQuestionId(), ans, p.getExplanation());
                if (reformulated != null) {
                    body.append(reformulated).append(" ");
                } else {
                    body.append("• ").append(p.getQuestion()).append(" — ").append(ans).append('\n');
                }
            }
            body.append("\n");
        }
        body.append('\n');

        body.append("=== DÉCISIONS ===\n")
            .append("Les échanges en séance ont permis de valider les orientations stratégiques du club pour la période à venir.\n\n");

        body.append("=== PLAN D'ACTION ===\n")
            .append(generateTaskInsight(tasks)).append("\n\n");

        body.append("=== CLÔTURE ===\n")
            .append(generateFeedbackInsight(fb)).append("\n");

        if (additionalNotes != null && !additionalNotes.isBlank()) {
            body.append("\nNotes complémentaires :\n").append(additionalNotes.trim()).append('\n');
        }
        body.append("\nLe secrétaire de séance,\n____________________\n");
        return body.toString();
    }

    private String generateAttendanceInsight(Map<String, Object> att) {
        int checkedIn = Integer.parseInt(strOr(att.get("checkedIn"), "0"));
        int confirmed = Integer.parseInt(strOr(att.get("confirmed"), "0"));
        int rate = Integer.parseInt(strOr(att.get("attendanceRatePct"), "0"));

        if (rate >= 80) {
            return String.format("L'événement a connu une mobilisation exceptionnelle avec un taux de présence de %d%% (%d participants), témoignant d'un fort engagement des membres.", rate, checkedIn);
        } else if (rate >= 50) {
            return String.format("La participation a été satisfaisante avec %d participants présents sur %d inscrits, assurant la représentativité nécessaire aux échanges.", checkedIn, confirmed);
        } else {
            return String.format("Une participation modérée de %d%% a été enregistrée. Une analyse des causes de cet absentéisme est recommandée pour les prochaines éditions.", rate);
        }
    }

    private String generateTaskInsight(Map<String, Object> tasks) {
        int done = Integer.parseInt(strOr(tasks.get("done"), "0"));
        int total = Integer.parseInt(strOr(tasks.get("total"), "0"));

        if (total == 0) return "Aucune tâche opérationnelle n'était rattachée à cet événement.";
        if (done == total) {
            return String.format("L'intégralité du plan d'action (%d/%d tâches) a été exécutée avec succès avant la clôture de l'événement.", done, total);
        } else if (done > 0) {
            return String.format("Le déploiement opérationnel est finalisé à %d%%. Les tâches restantes ont été reportées au planning de suivi.", (done * 100 / total));
        } else {
            return "Le plan d'action initial présente un retard d'exécution significatif nécessitant une intervention du bureau.";
        }
    }

    private String generateFeedbackInsight(Map<String, Object> fb) {
        double avg = Double.parseDouble(strOr(fb.get("avgOrganization"), "0.0").replace(",", "."));
        long count = Long.parseLong(strOr(fb.get("count"), "0"));

        if (count == 0) return "Les retours qualitatifs des participants seront intégrés dès réception des formulaires de satisfaction.";
        if (avg >= 4.0) {
            return String.format("L'excellence de l'organisation a été saluée par les membres avec une note moyenne de %.1f/5, validant les choix logistiques effectués.", avg);
        } else if (avg >= 3.0) {
            return String.format("La qualité globale de l'événement est jugée satisfaisante (%.1f/5), bien que des pistes d'amélioration aient été identifiées.", avg);
        } else {
            return String.format("Le bilan de satisfaction (%.1f/5) indique des points de vigilance majeurs à adresser lors des prochaines sessions.", avg);
        }
    }
}
