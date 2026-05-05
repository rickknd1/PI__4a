# -*- coding: utf-8 -*-
"""Generate the two PFE technical reports as PDF.

Output:
  - rapport_ia_validation_technique.pdf
  - rapport_evenements_besoins_devis_pv_taches.pdf
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether,
)


# ── Styles ─────────────────────────────────────────────────────────────

def build_styles():
    base = getSampleStyleSheet()

    title = ParagraphStyle(
        "Title2", parent=base["Title"], fontSize=20, leading=24,
        textColor=colors.HexColor("#1e293b"), spaceAfter=8,
    )
    subtitle = ParagraphStyle(
        "Subtitle", parent=base["Normal"], fontSize=11, leading=14,
        textColor=colors.HexColor("#64748b"), spaceAfter=18,
    )
    h1 = ParagraphStyle(
        "H1b", parent=base["Heading1"], fontSize=15, leading=19,
        textColor=colors.HexColor("#0e7490"), spaceBefore=14, spaceAfter=6,
        keepWithNext=True,
    )
    h2 = ParagraphStyle(
        "H2b", parent=base["Heading2"], fontSize=12.5, leading=16,
        textColor=colors.HexColor("#1e293b"), spaceBefore=10, spaceAfter=4,
        keepWithNext=True,
    )
    h3 = ParagraphStyle(
        "H3b", parent=base["Heading3"], fontSize=11, leading=14,
        textColor=colors.HexColor("#334155"), spaceBefore=6, spaceAfter=2,
        keepWithNext=True,
    )
    body = ParagraphStyle(
        "Body2", parent=base["BodyText"], fontSize=9.7, leading=13.5,
        alignment=TA_JUSTIFY, textColor=colors.HexColor("#1e293b"),
        spaceAfter=4,
    )
    bullet = ParagraphStyle(
        "Bullet", parent=body, leftIndent=14, bulletIndent=4,
        spaceAfter=2,
    )
    code = ParagraphStyle(
        "Code", parent=base["Code"], fontSize=8.4, leading=11,
        textColor=colors.HexColor("#0f172a"),
        backColor=colors.HexColor("#f1f5f9"),
        borderColor=colors.HexColor("#cbd5e1"),
        borderWidth=0.5, borderPadding=5,
        leftIndent=2, rightIndent=2, spaceAfter=6,
    )
    callout = ParagraphStyle(
        "Callout", parent=body,
        backColor=colors.HexColor("#ecfeff"),
        borderColor=colors.HexColor("#67e8f9"),
        borderWidth=0.7, borderPadding=8,
        leftIndent=2, rightIndent=2, spaceBefore=4, spaceAfter=8,
    )
    return dict(title=title, subtitle=subtitle,
                h1=h1, h2=h2, h3=h3, body=body, bullet=bullet,
                code=code, callout=callout)


# ── Helpers ────────────────────────────────────────────────────────────

def make_table(rows, col_widths=None, header=True):
    t = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.8),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0e7490")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
            [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    t.setStyle(TableStyle(style))
    return t


def page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#94a3b8"))
    canvas.drawString(
        20 * mm, 12 * mm,
        f"ClubHub PFE — {doc._title_short}",
    )
    canvas.drawRightString(
        A4[0] - 20 * mm, 12 * mm,
        f"page {doc.page}",
    )
    canvas.restoreState()


def build_doc(path, title_short):
    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=title_short, author="ClubHub",
    )
    doc._title_short = title_short
    return doc


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  RAPPORT 1 — Validation technique des 3 modèles d'IA                ║
# ╚══════════════════════════════════════════════════════════════════════╝

def build_report_ia(out_path):
    s = build_styles()
    doc = build_doc(out_path, "Validation technique des modèles d'IA")
    story = []

    # ── Titre ──
    story.append(Paragraph("Validation technique des modèles d'IA", s["title"]))
    story.append(Paragraph(
        "ClubHub — Recommandation, génération de PV, et analyse de sentiment "
        "des retours participants. Document de soutenance PFE.",
        s["subtitle"],
    ))

    # ── Architecture ──
    story.append(Paragraph("Architecture en cascade (3 niveaux)", s["h1"]))
    story.append(Paragraph(
        "Le système suit un principe <b>fail-safe</b> à 3 tiers, déclenchés "
        "dans l'ordre : modèles internes scikit-learn → LLM local Ollama → "
        "templates Java déterministes. Le backend Java appelle le Tier 1 en "
        "premier ; sur <i>null</i>, il tente le Tier 2 ; sur échec, il sert "
        "le Tier 3. Aucune interruption de service n'est possible.",
        s["body"],
    ))

    arch_data = [
        ["Tier", "Composant", "Endpoints", "Caractéristiques"],
        ["1", "Modèles custom (scikit-learn)",
         "/v1/custom/recommend\n/v1/custom/pv\n/v1/custom/sentiment",
         "Rapide, hors ligne, explicable, .pkl reproductible"],
        ["2", "LLM via Ollama (llama3.2:3b)",
         "/v1/generate/text\n/v1/generate/json",
         "Raisonnement libre, optionnel, fallback du Tier 1"],
        ["3", "Templates Java déterministes",
         "(en mémoire backend)",
         "Garantie de service même hors AI"],
    ]
    story.append(make_table(arch_data, col_widths=[1.0*cm, 4.5*cm, 5.5*cm, 6.0*cm]))
    story.append(Spacer(1, 6))

    # ──────────────────────────────────────────────────────────────────
    # 1. Recommandation
    # ──────────────────────────────────────────────────────────────────
    story.append(Paragraph(
        "① Recommandation d'événements — RandomForestRegressor", s["h1"]))
    story.append(Paragraph(
        "<b>Fichier :</b> ai-service/app/custom/recommender.py", s["body"]))

    story.append(Paragraph("Algorithme", s["h2"]))
    story.append(Paragraph(
        "<b>Modèle :</b> <font face='Courier'>RandomForestRegressor"
        "(n_estimators=80, max_depth=5, min_samples_leaf=1, random_state=42)"
        "</font>", s["body"]))
    story.append(Paragraph(
        "<b>Tâche :</b> régression — prédire le taux de présence dans [0,1] "
        "d'un événement futur.", s["body"]))

    story.append(Paragraph("Features (6 colonnes)", s["h2"]))
    feat_data = [
        ["Feature", "Type", "Encodage / valeur"],
        ["format", "catégorielle", "OrdinalEncoder (workshop, conference, …)"],
        ["dayOfWeek", "catégorielle", "OrdinalEncoder (MONDAY…SUNDAY)"],
        ["hour", "numérique", "heure de début (10–22)"],
        ["capacity", "numérique", "nombre de places"],
        ["staffSize", "numérique", "nombre d'encadrants"],
        ["feedbackComposite", "numérique", "moyenne des notes passées (-1 si absente)"],
    ]
    story.append(make_table(feat_data, col_widths=[4.3*cm, 3.0*cm, 9.7*cm]))
    story.append(Paragraph(
        "<b>Cible (y) :</b> attendanceRate = scannedAttendees / capacity "
        "(mesurée par scan QR-code, fiable).", s["body"]))

    story.append(Paragraph("Justification du choix", s["h2"]))
    bullets = [
        "<b>Espace d'entrée petit et bien typé</b> → Random Forest converge "
        "en quelques dizaines d'exemples ; pas besoin d'un LLM.",
        "<b>Pas d'hallucination</b> : la sortie est un nombre borné, pas du texte.",
        "<b>Explicabilité native</b> : feature_importances_ donne le poids "
        "de chaque variable (la note moyenne pèse ~91% sur l'historique observé).",
        "<b>Artefact reproductible</b> : recommender.pkl (~200 KB), versionné, "
        "rechargé au boot de l'AI service.",
    ]
    for b in bullets:
        story.append(Paragraph("• " + b, s["bullet"]))

    story.append(Paragraph("Validation", s["h2"]))
    val_bullets = [
        "<b>R² sur l'apprentissage</b> journalisé à chaque entraînement "
        "(recommender.py:286).",
        "<b>Seuil de confiance par bucket</b> (CONF_THRESHOLDS) : low &lt; 2 obs, "
        "medium &lt; 5, high ≥ 5 — empêche les recommandations sur trop peu de données.",
        "<b>Bornage</b> max(0.0, min(1.0, pred)) — pas de prédiction hors-domaine.",
        "<b>Fallback</b> : si moins de 4 événements utilisables, on retombe "
        "sur des agrégats statistiques purs (Tier 3).",
    ]
    for b in val_bullets:
        story.append(Paragraph("• " + b, s["bullet"]))

    story.append(PageBreak())

    # ──────────────────────────────────────────────────────────────────
    # 2. PV
    # ──────────────────────────────────────────────────────────────────
    story.append(Paragraph(
        "② Génération de PV — NLP basé sur règles + classifieur de sentiment",
        s["h1"]))
    story.append(Paragraph(
        "<b>Fichier :</b> ai-service/app/custom/pv_builder.py", s["body"]))

    story.append(Paragraph("Algorithme — pipeline hybride", s["h2"]))
    story.append(Paragraph(
        "Pas un seul modèle mais une <b>chaîne de transformations</b> :", s["body"]))

    pipe_bullets = [
        "<b>Templates Yes/No à mots-clés</b> (pv_builder.py:83) — 17 entrées "
        "(programme, intervenant, budget, sécurité, …). Chaque mot-clé → 2 "
        "phrases françaises (affirmation / négation passive). Match insensible "
        "à la casse sur le texte de la question.",
        "<b>Templates de reformulation libre</b> (pv_builder.py:155) — "
        "placeholders {A}, {a}, {A_nofp}, {a_nofp} pour normaliser la casse "
        "et la ponctuation. Tisse la réponse du secrétaire dans une phrase "
        "complète française.",
        "<b>Variations génériques</b> avec rotation par index pour éviter "
        "des phrases identiques quand le secrétaire répète \"Oui\" 6 fois.",
        "<b>Classifieur de sentiment</b> (Tier 1) avec fallback lexical "
        "(Tier 2) — voir §③.",
    ]
    for b in pipe_bullets:
        story.append(Paragraph("• " + b, s["bullet"]))

    story.append(Paragraph("Pourquoi pas un LLM ?", s["h2"]))
    why_bullets = [
        "<b>Zéro hallucination</b> garantie : on ne génère que des phrases "
        "issues du template, jamais inventées.",
        "<b>Multilingue par design</b> : si le secrétaire écrit en darija, on "
        "le préserve verbatim entre guillemets « … ».",
        "<b>Format contraint</b> : sortie identique au template Java existant "
        "(<font face='Courier'>=== PRÉAMBULE ===</font> etc.) — Angular n'a "
        "rien à changer.",
        "<b>Numériques fidèles</b> : présence, taux, moyennes recopiés tels "
        "quels — aucune réécriture créative.",
    ]
    for b in why_bullets:
        story.append(Paragraph("• " + b, s["bullet"]))

    story.append(Paragraph("Validation", s["h2"]))
    val2 = [
        "<b>Test unitaire intégré</b> : ai-service/test_models.py vérifie un "
        "parcours complet bout-à-bout.",
        "<b>Idempotence</b> : même entrée → même sortie (déterministe).",
        "<b>Champ source dans le log Java</b> : <font face='Courier'>"
        "PvAiService: generated with custom rule-based NLP builder.</font> "
        "confirme le tier emprunté (PvAiService.java:66).",
    ]
    for b in val2:
        story.append(Paragraph("• " + b, s["bullet"]))

    story.append(PageBreak())

    # ──────────────────────────────────────────────────────────────────
    # 3. Sentiment (ajouté)
    # ──────────────────────────────────────────────────────────────────
    story.append(Paragraph(
        "③ Sentiment des commentaires — Logistic Regression + TF-IDF "
        "(ajout récent)", s["h1"]))
    story.append(Paragraph(
        "<b>Entraînement :</b> ai-service/train_sentiment.py "
        "→ artefact app/custom/models/pv_sentiment.pkl", s["body"]))

    story.append(Paragraph("Algorithme", s["h2"]))
    story.append(Paragraph(
        "<b>Pipeline scikit-learn :</b> "
        "<font face='Courier'>TfidfVectorizer(ngram_range=(1,2), min_df=1) "
        "→ LogisticRegression(max_iter=1000)</font>", s["body"]))
    story.append(Paragraph(
        "<b>Tâche :</b> classification multi-classe à 3 classes "
        "(0=négatif, 1=neutre, 2=positif).", s["body"]))

    story.append(Paragraph("Pourquoi (1, 2) — uni + bi-grammes ?", s["h2"]))
    story.append(Paragraph(
        "C'est <b>le choix critique</b> du modèle. Avec uni-grammes seuls, "
        "« pas mal » se décompose en [\"pas\", \"mal\"] → le mot « mal » "
        "déclenche un score négatif. Avec bi-grammes, le pipeline apprend "
        "« pas mal » comme une unité → classifié neutre/positif.", s["body"]))

    story.append(Paragraph(
        "Validation empirique sur jeu de test (curl) :", s["body"]))
    story.append(Paragraph(
        "&nbsp;&nbsp;\"Pas mal mais long sur la fin.\" → neutral (0.386) ✓<br/>"
        "&nbsp;&nbsp;\"Trop de retard, deçu.\" → negative (0.399) ✓<br/>"
        "&nbsp;&nbsp;\"Excellent atelier...\" → positive (0.584) ✓",
        s["code"]))

    story.append(Paragraph("Pourquoi LogReg et pas un Transformer (CamemBERT) ?", s["h2"]))
    comp_data = [
        ["Critère", "LogReg + TF-IDF", "CamemBERT"],
        ["Taille du modèle", "~50 KB", "~440 MB"],
        ["Inférence (CPU)", "&lt; 1 ms / commentaire", "~200 ms"],
        ["Données nécessaires", "dizaines", "milliers"],
        ["Explicabilité", "coefficients par token", "boîte noire"],
    ]
    story.append(make_table(comp_data, col_widths=[4.5*cm, 5.5*cm, 5.0*cm]))
    story.append(Paragraph(
        "Pour un PFE avec un dataset bootstrap de 30 phrases, <b>LogReg "
        "domine</b>. Si plus tard vous accumulez 10k commentaires labellisés, "
        "le code reste compatible — on remplace juste le .pkl.", s["body"]))

    story.append(Paragraph("Endpoint et flux d'intégration", s["h2"]))
    story.append(Paragraph(
        "<b>POST /v1/custom/sentiment</b> (main.py) — entrée : "
        "<font face='Courier'>{ \"comments\": [\"...\", \"...\"] }</font>",
        s["body"]))
    story.append(Paragraph(
        "Sortie validée par curl :", s["body"]))
    story.append(Paragraph(
        "{<br/>"
        "&nbsp;&nbsp;\"count\": 6,<br/>"
        "&nbsp;&nbsp;\"positive\": 3, \"neutral\": 1, \"negative\": 2,<br/>"
        "&nbsp;&nbsp;\"percentPositive\": 50.0, \"percentNeutral\": 16.7, \"percentNegative\": 33.3,<br/>"
        "&nbsp;&nbsp;\"items\": [{\"index\":0, \"text\":\"...\", \"label\":\"positive\", \"confidence\":0.584}, ...],<br/>"
        "&nbsp;&nbsp;\"model\": \"logreg-tfidf-bigrams\",<br/>"
        "&nbsp;&nbsp;\"source\": \"custom\"<br/>"
        "}", s["code"]))

    story.append(Paragraph("Chaîne d'appel Frontend → AI service :", s["body"]))
    story.append(Paragraph(
        "Angular FeedbackSentimentModalComponent<br/>"
        "&nbsp;&nbsp;→ GET /api/feedbacks/event/{id}/sentiment<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;→ EventFeedbackController.sentiment()<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ EventAiService.analyzeFeedbackSentiment(eventId)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|  pull comments from MongoDB (filter c != null && !c.isBlank())<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ LocalAiClient.analyzeSentiment(comments)<br/>"
        "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;→ POST http://localhost:8000/v1/custom/sentiment",
        s["code"]))

    story.append(PageBreak())

    # ──────────────────────────────────────────────────────────────────
    # COMMENT TESTER + INTERFACE
    # ──────────────────────────────────────────────────────────────────
    story.append(Paragraph(
        "④ Comment tester l'IA et ce que doit afficher l'interface",
        s["h1"]))

    # 4.1 Tests directs
    story.append(Paragraph("4.1 Tests directs sur le service AI", s["h2"]))
    story.append(Paragraph(
        "Avant tout, vérifier que le service Python répond et que les "
        "modèles sont chargés :", s["body"]))
    story.append(Paragraph(
        "$ curl http://localhost:8000/health<br/>"
        "{\"status\":\"ok\", \"provider\":\"ollama\", \"upstream_reachable\":false,<br/>"
        "&nbsp;\"model\":\"llama3.2:3b\", \"custom_models_enabled\":true,<br/>"
        "&nbsp;\"custom_recommender_loaded\":true}",
        s["code"]))
    story.append(Paragraph(
        "<b>Champs à vérifier :</b>", s["body"]))
    chk = [
        "<font face='Courier'>custom_models_enabled: true</font> — sinon les "
        "Tier 1 sont désactivés (variable d'env CUSTOM_MODELS_ENABLED).",
        "<font face='Courier'>custom_recommender_loaded: true</font> — le "
        ".pkl du RandomForest a bien été chargé au boot.",
        "<font face='Courier'>upstream_reachable</font> ne concerne que le "
        "LLM Ollama (Tier 2). Sa valeur false n'affecte PAS les modèles "
        "custom.",
    ]
    for b in chk:
        story.append(Paragraph("• " + b, s["bullet"]))

    story.append(Paragraph("Test de la recommandation :", s["h3"]))
    story.append(Paragraph(
        "$ curl -X POST http://localhost:8000/v1/custom/recommend \\<br/>"
        "&nbsp;&nbsp;-H \"Content-Type: application/json\" \\<br/>"
        "&nbsp;&nbsp;-d '{\"facts\":[{\"format\":\"workshop\",\"dayOfWeek\":\"SATURDAY\",<br/>"
        "&nbsp;&nbsp;&nbsp;\"startDate\":\"2025-11-08T14:00\",\"capacity\":40,\"rsvpConfirmed\":33,<br/>"
        "&nbsp;&nbsp;&nbsp;\"scannedAttendees\":31,\"feedbackComposite\":4.2}]}'",
        s["code"]))
    story.append(Paragraph(
        "Attendu : 200 OK avec topFormats[], topStaff[], suggestedTiming, "
        "insights[], nextActions[]. Champ <font face='Courier'>"
        "model: \"RandomForestRegressor (scikit-learn)\"</font> côté backend Java.",
        s["body"]))

    story.append(Paragraph("Test du sentiment :", s["h3"]))
    story.append(Paragraph(
        "$ curl -X POST http://localhost:8000/v1/custom/sentiment \\<br/>"
        "&nbsp;&nbsp;-H \"Content-Type: application/json\" \\<br/>"
        "&nbsp;&nbsp;-d '{\"comments\":[\"Excellent atelier !\",\"Trop de retard, deçu.\",\"Pas mal mais long.\"]}'",
        s["code"]))
    story.append(Paragraph(
        "Attendu : 200 OK avec count, positive/neutral/negative, percent*, "
        "items[]. Sinon 503 si le .pkl n'est pas chargé "
        "(<font face='Courier'>python train_sentiment.py</font> à exécuter).",
        s["body"]))

    story.append(Paragraph("Test du PV :", s["h3"]))
    story.append(Paragraph(
        "$ curl -X POST http://localhost:8000/v1/custom/pv \\<br/>"
        "&nbsp;&nbsp;-H \"Content-Type: application/json\" \\<br/>"
        "&nbsp;&nbsp;-d '{\"context\":{\"title\":\"Réunion test\",\"format\":\"meeting\"},<br/>"
        "&nbsp;&nbsp;&nbsp;\"qaPairs\":[],\"additionalNotes\":\"\"}'",
        s["code"]))
    story.append(Paragraph(
        "Attendu : 200 OK avec un champ <font face='Courier'>text</font> "
        "non vide formaté en sections === PRÉAMBULE === / === DÉROULEMENT === "
        "etc.", s["body"]))

    # 4.2 Tests par l'interface
    story.append(Paragraph("4.2 Validation par l'interface utilisateur", s["h2"]))

    story.append(Paragraph(
        "Chaque AI a une preuve <b>visible</b> côté UI qui prouve quel tier "
        "a répondu, sans avoir à lire les logs.", s["body"]))

    ui_data = [
        ["Fonctionnalité", "Où le voir", "Indicateur de Tier 1 (custom-ML)"],
        ["Recommandation",
         "Modal Smart Suggestions au-dessus du formulaire de création d'événement",
         "Badge « stats / based on N past events ».\nLe JSON de /api/recommendations/events affiche\nsource: \"custom-ml\" et model: « RandomForestRegressor »"],
        ["PV",
         "Wizard PV (page Calendar — bouton « ✨ AI feedback summary » côté événement passé)",
         "Log backend : PvAiService: generated with custom\nrule-based NLP builder.\nFormat sortie : === PRÉAMBULE === / === DÉROULEMENT ==="],
        ["Sentiment",
         "Bouton « 🧠 Sentiment insights » sur l'événement passé\n(à côté de l'AI summary)",
         "Header : badge « custom ML ».\nFooter : « Scored offline by logreg-tfidf-bigrams »"],
    ]
    story.append(make_table(ui_data, col_widths=[3.5*cm, 5.5*cm, 8.0*cm]))

    story.append(Paragraph(
        "4.3 Que doit contenir l'interface (par AI)", s["h2"]))

    # Recommandation
    story.append(Paragraph("Recommandation — widget « Smart Suggestions »",
                           s["h3"]))
    rec_ui = [
        "<b>Bandeau d'en-tête</b> : icône ✨ + titre « Smart suggestions », "
        "sous-titre « based on N past events », bouton « Hide ».",
        "<b>Bloc « Recommended format »</b> : nom du format (ex. Competition), "
        "score sur 100, action « Use this → » qui pré-remplit le formulaire.",
        "<b>Bloc « Recommended date / time slot »</b> : jour + créneau "
        "(ex. Monday · evening 18:00), date suggérée, score, rationale.",
        "<b>Liste « Best days from past events »</b> : top 3 jours avec "
        "nombre d'événements, taux de présence, heure typique, score, "
        "badge de confiance (low / medium / high).",
        "<b>Liste « Top formats by performance »</b> : 5 formats classés "
        "avec attendance, feedback, score, prédiction du modèle.",
        "<b>Liste « Suggested staff to invite »</b> : personnel classé par "
        "performance historique (présence × note moyenne).",
        "<b>Section « Insights »</b> : 3 à 5 phrases en français qui "
        "expliquent pourquoi (ex. « le modèle RandomForest identifie la note "
        "moyenne comme le facteur dominant — importance 91% »).",
        "<b>Section « Next actions to try »</b> : 2 à 3 actions concrètes "
        "à appliquer.",
    ]
    for b in rec_ui:
        story.append(Paragraph("• " + b, s["bullet"]))

    # PV
    story.append(Paragraph("PV — wizard de génération", s["h3"]))
    pv_ui = [
        "<b>Étape 1 — Contexte automatique</b> : panneau read-only avec les "
        "données réelles de l'événement (RSVP, présence, tâches, devis, "
        "retours). Le secrétaire ne peut pas les modifier.",
        "<b>Étape 2 — Q&A structuré</b> : ~10 questions par section "
        "(préambule, déroulement, résultats, perspectives, clôture), "
        "Yes/No ou texte libre, dans toute langue.",
        "<b>Étape 3 — Aperçu généré</b> : texte français formaté en sections "
        "=== PRÉAMBULE === etc. <b>Éditable</b> avant sauvegarde.",
        "<b>Bloc d'export</b> : bouton « Télécharger PDF » via "
        "/api/meeting-pv/{id}/pdf.",
        "<b>Indicateur de tier</b> : un footer discret « Generated by "
        "rule-based-nlp (fr) » prouve que ce n'est pas du LLM.",
    ]
    for b in pv_ui:
        story.append(Paragraph("• " + b, s["bullet"]))

    # Sentiment
    story.append(Paragraph("Sentiment — modal « Sentiment insights »", s["h3"]))
    sent_ui = [
        "<b>Bandeau d'en-tête</b> : icône 🧠, titre « Feedback sentiment », "
        "badge « custom ML », sous-titre « N comments scored ».",
        "<b>Section « Overall breakdown »</b> : 3 barres horizontales "
        "(Positive vert / Neutral ambre / Negative rouge) avec pourcentage "
        "et compte absolu.",
        "<b>Section « 👎 Needs attention »</b> (priorité haute) : liste des "
        "commentaires classés négatifs, avec confidence affichée.",
        "<b>Section « 👍 Highlights »</b> : commentaires positifs.",
        "<b>Section « ⚖️ Mixed / neutral »</b> : repliable par défaut "
        "(bouton « show / hide »).",
        "<b>Footer</b> : « Scored offline by logreg-tfidf-bigrams » + note "
        "explicative sur la confidence.",
    ]
    for b in sent_ui:
        story.append(Paragraph("• " + b, s["bullet"]))

    # 4.4 États gracieux
    story.append(Paragraph("4.4 États gracieux à tester (3 AI)", s["h2"]))
    states_data = [
        ["État", "Cause", "Comportement attendu"],
        ["loading", "Requête en cours", "Spinner + message « Scoring… »"],
        ["disabled (503)", "Tier 1 indisponible (modèle non chargé)",
         "Empty state avec lien d'aide vers run.ps1 / train_sentiment.py"],
        ["empty (404)", "Aucune donnée à analyser",
         "Message « No comments to analyse yet »"],
        ["ready (200)", "Réponse OK",
         "Affichage normal du widget"],
        ["error (502)", "Erreur réseau / parsing",
         "Bouton « Retry » + message d'erreur"],
    ]
    story.append(make_table(states_data, col_widths=[3.0*cm, 5.5*cm, 8.5*cm]))

    # ── Synthèse ──
    story.append(PageBreak())
    story.append(Paragraph("Synthèse pour la défense", s["h1"]))

    synth_data = [
        ["Modèle", "Type", "Sortie", "Données min.", "Latence"],
        ["Recommandation", "RandomForest régression",
         "attendanceRate ∈ [0,1]", "≥4 événements", "~10 ms"],
        ["PV", "Templates + LogReg sentiment",
         "texte FR structuré", "aucune", "~50 ms"],
        ["Sentiment", "LogReg + TF-IDF bi-grammes",
         "{label, confidence} × N", "modèle pré-entraîné", "&lt; 5 ms / 100 com."],
    ]
    story.append(make_table(synth_data,
                            col_widths=[3.5*cm, 3.8*cm, 3.8*cm, 3.0*cm, 2.9*cm]))

    story.append(Paragraph(
        "<b>Argument-clé</b> : aucun de ces trois modèles n'est un LLM. "
        "Tous sont entraînés en interne sur les données du club, exportables "
        "en .pkl, explicables (importance des features ou coefficients "
        "TF-IDF), et déployables sans clé API ni Docker. Le LLM via Ollama "
        "existe en Tier 2 mais reste optionnel — la démonstration tourne "
        "entièrement hors-ligne avec les 3 modèles custom.",
        s["callout"]))

    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)


# ╔══════════════════════════════════════════════════════════════════════╗
# ║  RAPPORT 2 — Événements (physiques) + Besoins/Devis + PV + Tâches  ║
# ╚══════════════════════════════════════════════════════════════════════╝

def build_report_workflow(out_path):
    s = build_styles()
    doc = build_doc(out_path,
                    "Calendrier événements, besoins, devis, PV, tâches")
    story = []

    # ── Titre ──
    story.append(Paragraph(
        "Calendrier d'événements, besoins, devis, PV et tâches", s["title"]))
    story.append(Paragraph(
        "ClubHub — module Event Management. Périmètre : événements physiques "
        "(les événements virtuels sont hors champ ici).",
        s["subtitle"],
    ))

    # ── Vue d'ensemble ──
    story.append(Paragraph("Vue d'ensemble du flux", s["h1"]))
    story.append(Paragraph(
        "Le module gère le cycle de vie complet d'un événement physique, du "
        "moment où il est créé dans le calendrier jusqu'à la production du "
        "procès-verbal après son achèvement. Quatre sous-modules sont "
        "interconnectés autour de l'entité Event :", s["body"]))

    flow = [
        "<b>1. Calendrier d'événements</b> — création, planification, suivi.",
        "<b>2. Besoins matériels</b> (BorrowedItem) — déclaration des besoins "
        "logistiques rattachés à un événement.",
        "<b>3. Devis</b> (Devis) — collecte des offres fournisseurs et "
        "validation par le trésorier.",
        "<b>4. Tâches</b> (Task) — répartition opérationnelle entre membres "
        "du club, avec compte-rendu de complétion.",
        "<b>5. PV</b> (MeetingPv) — formalisation post-événement.",
    ]
    for b in flow:
        story.append(Paragraph("• " + b, s["bullet"]))

    story.append(Paragraph(
        "Tous ces sous-modules partagent l'identifiant <font face='Courier'>"
        "eventId</font> de l'événement, ce qui permet l'agrégation des "
        "données lors de la génération du PV (le contexte automatique récupère "
        "RSVP, tâches, devis, et retours en un seul appel).",
        s["body"]))

    # ╠═════════════════════════════════════════════════════════════════
    # 1. Calendrier
    # ╠═════════════════════════════════════════════════════════════════
    story.append(Paragraph(
        "① Calendrier d'événements (physiques)", s["h1"]))

    story.append(Paragraph("Entité Event", s["h2"]))
    story.append(Paragraph(
        "Collection MongoDB <font face='Courier'>events</font>. Champs "
        "principaux :", s["body"]))

    ev_data = [
        ["Champ", "Type", "Description"],
        ["title, description", "String", "Métadonnées affichées sur le calendrier"],
        ["startDate, endDate", "LocalDateTime", "Bornes temporelles (compatibles camelCase ET snake_case via @JsonProperty)"],
        ["location", "EventLocation", "Adresse + coordonnées GPS (Leaflet)"],
        ["capacity", "Integer", "Places maximum, sert de dénominateur au taux de présence"],
        ["status", "String", "draft / published / completed / cancelled"],
        ["eventFormat", "String", "workshop, competition, conference, training, networking, trip_outing, other"],
        ["staff", "List<EventStaffMember>", "Encadrement assigné (nom + rôle)"],
        ["rsvpCount, attendanceCount", "Integer", "Compteurs dénormalisés mis à jour par les modules RSVP / QR-scan"],
        ["isDeleted", "Boolean", "Soft delete — conservé pour les agrégations historiques"],
    ]
    story.append(make_table(ev_data, col_widths=[4.0*cm, 3.5*cm, 9.5*cm]))

    story.append(Paragraph(
        "Le double champ camelCase + snake_case existe pour assurer la "
        "compatibilité avec d'anciens documents historisés en snake_case "
        "(getter unifié <font face='Courier'>getStartDate()</font> qui "
        "retourne la valeur non-nulle prioritaire).", s["body"]))

    story.append(Paragraph("Endpoints REST", s["h2"]))
    ev_ep_data = [
        ["Méthode", "URL", "Rôle"],
        ["GET", "/api/events", "Liste complète (non supprimés)"],
        ["GET", "/api/events/with-counts", "Liste enrichie avec compteurs RSVP / présence en temps réel"],
        ["GET", "/api/events/upcoming", "Événements à venir (startDate > now)"],
        ["GET", "/api/events/past", "Événements passés (utilisé par le recommender + le PV)"],
        ["GET", "/api/events/status/{status}", "Filtrage par statut"],
        ["GET", "/api/events/search", "Recherche plein-texte sur le titre"],
        ["GET", "/api/events/stats", "Agrégats globaux pour le dashboard"],
        ["GET", "/api/events/filtered", "Filtrage multi-critères (format, période…)"],
        ["GET", "/api/events/{id}", "Détail"],
        ["GET", "/api/events/{eventId}/attendance", "Liste des présents (scannés)"],
        ["POST", "/api/events", "Création — assigne createdBy, createdAt, status par défaut"],
        ["PUT", "/api/events/{id}", "Mise à jour"],
        ["DELETE", "/api/events/{id}", "Soft delete (isDeleted=true)"],
    ]
    story.append(make_table(ev_ep_data, col_widths=[2.0*cm, 6.0*cm, 9.0*cm]))

    story.append(Paragraph("Frontend Angular", s["h2"]))
    fe = [
        "<b>Page Calendar</b> (pages/calender/) — utilise FullCalendar avec "
        "les plugins dayGrid, timeGrid et interaction (drag & drop).",
        "<b>Modal de création / édition</b> avec sélecteur de format, date "
        "+ heure, capacité, lieu (carte Leaflet pour saisir / déplacer le "
        "marker), et liste de staff.",
        "<b>Widget Smart Suggestions</b> intégré au formulaire — affiche en "
        "live les recommandations du RandomForest (cf. rapport AI).",
        "<b>Bouton « AI feedback summary »</b> + « 🧠 Sentiment insights » "
        "n'apparaissent QUE pour les événements passés ou status=completed.",
    ]
    for b in fe:
        story.append(Paragraph("• " + b, s["bullet"]))

    story.append(PageBreak())

    # ╠═════════════════════════════════════════════════════════════════
    # 2. Besoins matériels (BorrowedItem)
    # ╠═════════════════════════════════════════════════════════════════
    story.append(Paragraph("② Besoins matériels — BorrowedItem", s["h1"]))

    story.append(Paragraph("Concept", s["h2"]))
    story.append(Paragraph(
        "Un <b>BorrowedItem</b> (« besoin ») représente un item logistique "
        "nécessaire à un événement (matériel, salle, prestataire, transport…). "
        "Il est créé par l'organisateur, complété par les responsables qui "
        "récoltent des devis fournisseurs, puis finalisé par le trésorier "
        "qui valide un devis et met à jour le statut.",
        s["body"]))

    story.append(Paragraph("Entité BorrowedItem", s["h2"]))

    bi_data = [
        ["Section", "Champs principaux", "Rôle"],
        ["Identifiants",
         "id, eventId, eventName, itemName, category",
         "Rattachement à l'événement + classification"],
        ["Quantification",
         "quantity, notes, estimatedBudget",
         "Estimation initiale (avant collecte de devis)"],
        ["Allocation interne",
         "allocationLocation, allocationPeriodStart/End,\nisAllocated, locationBudget",
         "Réservation logistique / espace"],
        ["RH",
         "staff[] (StaffMember : name, role, budget)",
         "Personnel dédié à cet item"],
        ["Prêteur (rempli par validation devis)",
         "lenderName, lenderType, lenderContactPerson,\nlenderPhone, lenderEmail, lenderAddress",
         "Reportés depuis le devis validé"],
        ["Cycle prêt",
         "borrowedDate, expectedReturnDate, actualReturnDate",
         "Tracking matériel emprunté"],
        ["Finance",
         "rentalFee, deposit, isPaid, deliveryMethod",
         "Suivi paiement"],
        ["Statut",
         "status (requested / pending / validated / returned),\nreminderSent, validatedDevisId, validationNote",
         "Cycle de vie + audit trail"],
    ]
    story.append(make_table(bi_data, col_widths=[3.8*cm, 6.7*cm, 6.5*cm]))

    story.append(Paragraph("Endpoints REST", s["h2"]))
    bi_ep_data = [
        ["Méthode", "URL", "Rôle"],
        ["GET", "/api/borrowed-items", "Liste tri par borrowedDate desc"],
        ["POST", "/api/borrowed-items", "Création"],
        ["PUT", "/api/borrowed-items/{id}", "Mise à jour complète"],
        ["PATCH", "/api/borrowed-items/{id}/status", "Changement de statut"],
        ["PATCH", "/api/borrowed-items/{id}/return", "Marquer comme rendu"],
        ["PATCH", "/api/borrowed-items/{id}/return-date", "Mettre à jour la date de retour"],
        ["PATCH", "/api/borrowed-items/{id}/payment", "Marquer comme payé"],
        ["POST", "/api/borrowed-items/{id}/remind", "Envoyer un rappel au prêteur"],
        ["PATCH", "/api/borrowed-items/{id}/validate-devis", "Lien vers le devis retenu"],
        ["PATCH", "/api/borrowed-items/{id}/treasury-callback", "Webhook depuis le module Trésorerie"],
        ["DELETE", "/api/borrowed-items/{id}", "Suppression"],
        ["POST", "/api/borrowed-items/extract", "Extraction IA depuis un PDF de devis (legacy)"],
        ["POST", "/api/borrowed-items/extract-v2", "Extraction IA v2 (SmartExtractionService)"],
    ]
    story.append(make_table(bi_ep_data, col_widths=[2.0*cm, 6.5*cm, 8.5*cm]))

    story.append(Paragraph(
        "<b>Note sur l'extraction IA</b> : le module dispose d'un "
        "<font face='Courier'>SmartExtractionService</font> capable de "
        "lire un PDF de devis fournisseur via Apache PDFBox et d'en "
        "extraire automatiquement les champs (montant, contact, validité). "
        "Cela accélère la saisie, mais reste un assistant — l'utilisateur "
        "valide toujours.",
        s["callout"]))

    story.append(PageBreak())

    # ╠═════════════════════════════════════════════════════════════════
    # 3. Devis
    # ╠═════════════════════════════════════════════════════════════════
    story.append(Paragraph("③ Devis fournisseurs — Devis", s["h1"]))

    story.append(Paragraph("Concept", s["h2"]))
    story.append(Paragraph(
        "Pour un <b>BorrowedItem</b>, plusieurs <b>Devis</b> peuvent être "
        "soumis (typiquement 3 pour respecter la règle des 3 devis "
        "concurrents). Le trésorier valide UN devis ; les autres sont "
        "automatiquement marqués <font face='Courier'>rejected</font>. La "
        "validation déclenche aussi la création / mise à jour de la fiche "
        "<font face='Courier'>Lender</font> et un push vers le module "
        "Trésorerie.",
        s["body"]))

    story.append(Paragraph("Entité Devis", s["h2"]))
    dv_data = [
        ["Champ", "Type", "Description"],
        ["id", "String", "Identifiant Mongo"],
        ["borrowedItemId", "String", "Lien vers le besoin parent"],
        ["supplierName", "String", "Raison sociale du fournisseur"],
        ["amount", "Double", "Montant TTC"],
        ["validUntil", "String (ISO)", "Date de validité du devis"],
        ["contactName, contactPhone, contactEmail",
         "String", "Coordonnées du contact commercial"],
        ["deliveryIncluded", "Boolean", "Livraison incluse ou non"],
        ["notes", "String", "Commentaires libres"],
        ["status", "String", "pending / validated / rejected"],
        ["validationNote", "String", "Justification du trésorier"],
        ["createdAt, validatedAt", "LocalDateTime", "Audit trail"],
    ]
    story.append(make_table(dv_data, col_widths=[5.0*cm, 3.5*cm, 8.5*cm]))

    story.append(Paragraph("Endpoints REST", s["h2"]))
    dv_ep_data = [
        ["Méthode", "URL", "Rôle"],
        ["GET", "/api/devis/all", "Pour agrégation budget par événement"],
        ["GET", "/api/devis/item/{itemId}", "Tous les devis d'un besoin"],
        ["POST", "/api/devis", "Soumission (statut pending par défaut)"],
        ["PATCH", "/api/devis/{id}/validate", "Validation par le trésorier"],
        ["PATCH", "/api/devis/{id}/reject", "Rejet manuel"],
        ["DELETE", "/api/devis/{id}", "Suppression"],
    ]
    story.append(make_table(dv_ep_data, col_widths=[2.0*cm, 6.5*cm, 8.5*cm]))

    story.append(Paragraph("Logique de validation (PATCH /validate)", s["h2"]))
    val_steps = [
        "Marquer ce devis comme <font face='Courier'>validated</font> avec "
        "validatedAt = now et validationNote saisie.",
        "Marquer tous les <b>siblings</b> (devis du même borrowedItemId) "
        "comme <font face='Courier'>rejected</font>.",
        "Reporter sur le <b>BorrowedItem</b> les coordonnées du fournisseur "
        "(lenderName, lenderPhone, lenderEmail, lenderContactPerson) et "
        "<font face='Courier'>validatedDevisId</font>.",
        "Upsert de la fiche <b>Lender</b> (créer si nouveau, mettre à jour "
        "les contacts sinon) — accélère la saisie pour les fournisseurs "
        "récurrents.",
        "Si 3 devis existent au total, push de la dépense dans le module "
        "<b>Trésorerie</b> via TreasuryIntegrationService (HTTP intra-app, "
        "transmet le cookie JWT pour authentification).",
    ]
    for i, v in enumerate(val_steps, 1):
        story.append(Paragraph(f"<b>{i}.</b> {v}", s["bullet"]))

    story.append(Paragraph(
        "Cette mécanique impose la <b>règle des 3 devis</b> sans la coder "
        "explicitement : le trésorier ne peut valider qu'à condition d'avoir "
        "saisi au moins 3 devis (côté UI), ce qui déclenche automatiquement "
        "la transmission Trésorerie. Le fait que les rejets soient "
        "automatiques après validation évite les états incohérents.",
        s["callout"]))

    story.append(PageBreak())

    # ╠═════════════════════════════════════════════════════════════════
    # 4. PV
    # ╠═════════════════════════════════════════════════════════════════
    story.append(Paragraph("④ Procès-verbal (PV) — MeetingPv", s["h1"]))

    story.append(Paragraph("Concept", s["h2"]))
    story.append(Paragraph(
        "Le <b>PV</b> est rédigé par un utilisateur ayant le rôle "
        "<font face='Courier'>SECRETAIRE_GENERALE</font> après l'événement. "
        "Le secrétaire ne rédige PAS librement : il répond à un Q&A structuré "
        "(toutes langues acceptées : français, anglais, arabe, darija). Le "
        "moteur d'IA — soit le builder NLP custom (Tier 1), soit le LLM "
        "Ollama (Tier 2), soit un template Java (Tier 3) — transforme ces "
        "réponses brutes en un PV formel français de 5 sections.",
        s["body"]))

    story.append(Paragraph("Entité MeetingPv", s["h2"]))
    pv_data = [
        ["Champ", "Description"],
        ["id, eventId", "Identification + lien événement (1:1, unique par event)"],
        ["eventTitle, eventDate", "Snapshot dénormalisé (resiste aux renommages)"],
        ["secretaryId, secretaryName", "Auteur du PV"],
        ["qaPairs[]", "Réponses brutes du secrétaire (QaPair : question, answer, type yesno|text, section, explanation)"],
        ["additionalNotes", "Notes libres"],
        ["generatedContent", "PV produit par l'IA, ÉDITABLE avant sauvegarde finale"],
        ["sourceLanguage", "fr | en | ar | tn | mixed (détection automatique)"],
        ["createdAt, updatedAt", "Audit"],
    ]
    story.append(make_table(pv_data, col_widths=[4.0*cm, 13.0*cm]))

    story.append(Paragraph("Endpoints REST", s["h2"]))
    pv_ep_data = [
        ["Méthode", "URL", "Rôle"],
        ["GET", "/api/meeting-pv/questions", "Liste structurée des questions par section"],
        ["GET", "/api/meeting-pv/event-context/{eventId}",
         "Contexte agrégé : RSVP, présence, tâches, devis, retours (read-only pour le wizard)"],
        ["GET", "/api/meeting-pv/pending",
         "Événements éligibles à un PV (passés ou complétés, pas de PV existant)"],
        ["POST", "/api/meeting-pv/generate",
         "Génération d'un brouillon SANS persistance (preview du wizard)"],
        ["POST", "/api/meeting-pv",
         "Sauvegarde du PV final (éventuellement édité par le secrétaire)"],
        ["GET", "/api/meeting-pv", "Liste des PV"],
        ["GET", "/api/meeting-pv/{id}", "Détail"],
        ["GET", "/api/meeting-pv/{id}/pdf", "Export PDF (généré côté serveur)"],
        ["DELETE", "/api/meeting-pv/{id}", "Suppression"],
    ]
    story.append(make_table(pv_ep_data, col_widths=[2.0*cm, 6.7*cm, 8.3*cm]))

    story.append(Paragraph("Wizard frontend (étapes)", s["h2"]))
    wiz = [
        "<b>Étape 1 — Sélection</b> : page /pv/pending qui liste les "
        "événements clos sans PV. Bouton « Rédiger le PV ».",
        "<b>Étape 2 — Contexte automatique</b> : panneau read-only avec "
        "les vraies données (RSVP scannés, taux de présence, tâches "
        "complétées, devis validés, moyenne des feedbacks). Le secrétaire "
        "<i>voit</i> ces données mais ne peut pas les modifier.",
        "<b>Étape 3 — Q&A guidé</b> : ~10 questions par section "
        "(préambule / déroulement / résultats / perspectives / clôture), "
        "type Yes/No (avec champ explanation si « Non ») ou texte libre.",
        "<b>Étape 4 — Génération</b> : appel à POST /generate qui retourne "
        "le brouillon. Affiché dans un éditeur de texte enrichi.",
        "<b>Étape 5 — Validation</b> : bouton « Sauvegarder » → POST "
        "/api/meeting-pv. Le secrétaire peut aussi régénérer pour comparer.",
        "<b>Étape 6 — Export</b> : bouton « Télécharger PDF » disponible "
        "à tout moment depuis la liste.",
    ]
    for b in wiz:
        story.append(Paragraph("• " + b, s["bullet"]))

    story.append(Paragraph("Cascade IA (rappel)", s["h2"]))
    pv_tiers_data = [
        ["Tier", "Source", "Reconnaissable au log"],
        ["1", "ai-service /v1/custom/pv (rule-based NLP)",
         "PvAiService: generated with custom rule-based NLP builder."],
        ["2", "Ollama via /v1/generate/text",
         "(absence du log Tier 1) + LLM call failed = false"],
        ["3", "Template Java fallbackTemplate()",
         "PvAiService: LLM disabled — falling back to built-in template"],
    ]
    story.append(make_table(pv_tiers_data, col_widths=[1.0*cm, 7.5*cm, 8.5*cm]))

    story.append(PageBreak())

    # ╠═════════════════════════════════════════════════════════════════
    # 5. Tâches
    # ╠═════════════════════════════════════════════════════════════════
    story.append(Paragraph("⑤ Tâches — Task", s["h1"]))

    story.append(Paragraph("Concept", s["h2"]))
    story.append(Paragraph(
        "Les <b>tâches</b> sont l'unité opérationnelle de la préparation "
        "d'un événement. Chaque tâche est rattachée à un événement "
        "(eventId), assignée à un membre du club (assignedTo), et suit "
        "un cycle de vie kanban (todo → in_progress → done). La complétion "
        "exige un <b>compte-rendu structuré</b> : on ne peut pas simplement "
        "« cocher terminé », il faut renseigner outcome + note + reason si "
        "applicable. Cela alimente directement la section « Déroulement » "
        "du PV.",
        s["body"]))

    story.append(Paragraph("Entité Task", s["h2"]))
    tk_data = [
        ["Champ", "Description"],
        ["id, eventId", "Identifiants + rattachement"],
        ["title, description", "Description de la tâche"],
        ["assignedTo, assigneeName, assigneeAvatar", "Cible (id + dénormalisation pour l'UI kanban)"],
        ["priority", "low / normal / high / urgent (défaut : normal)"],
        ["status", "todo / in_progress / done (défaut : todo)"],
        ["dueDate", "Échéance (ISO string)"],
        ["createdBy, createdAt, updatedAt", "Audit trail"],
        ["completionNote", "Résumé de ce qui a été accompli (rempli à la complétion)"],
        ["completionOutcome", "success / partial / skipped (REQUIS à la complétion)"],
        ["completionReason", "Justification (REQUISE si outcome != success)"],
        ["completedAt", "Horodatage de complétion"],
    ]
    story.append(make_table(tk_data, col_widths=[5.5*cm, 12.0*cm]))

    story.append(Paragraph("Endpoints REST", s["h2"]))
    tk_ep_data = [
        ["Méthode", "URL", "Rôle"],
        ["GET", "/api/tasks", "Toutes les tâches"],
        ["GET", "/api/tasks/user/{userId}", "Tâches assignées à un utilisateur"],
        ["GET", "/api/tasks/event/{eventId}", "Tâches d'un événement"],
        ["POST", "/api/tasks", "Création (createdAt = now)"],
        ["PUT", "/api/tasks/{id}", "Mise à jour complète"],
        ["PATCH", "/api/tasks/{id}/status",
         "Changement de statut. Si re-passé hors « done », nettoie completion*"],
        ["PATCH", "/api/tasks/{id}/complete",
         "Marquage final avec outcome / note / reason — voir validation ci-dessous"],
    ]
    story.append(make_table(tk_ep_data, col_widths=[2.0*cm, 5.5*cm, 9.5*cm]))

    story.append(Paragraph(
        "Validation de la complétion (PATCH /complete)", s["h2"]))
    cval = [
        "<font face='Courier'>outcome</font> est REQUIS et doit valoir "
        "<font face='Courier'>success</font>, "
        "<font face='Courier'>partial</font> ou "
        "<font face='Courier'>skipped</font>. Sinon HTTP 400.",
        "Si <font face='Courier'>outcome != success</font>, alors "
        "<font face='Courier'>reason</font> est REQUIS (sinon HTTP 400). "
        "Empêche le « cliquer fini sans expliquer ».",
        "Le statut est forcé à <font face='Courier'>done</font> et "
        "<font face='Courier'>completedAt = now</font>.",
        "Re-ouvrir une tâche (status != done) <b>nettoie</b> completionNote, "
        "completionOutcome, completionReason, completedAt — pas de "
        "fantôme de l'ancien commentaire.",
    ]
    for b in cval:
        story.append(Paragraph("• " + b, s["bullet"]))

    story.append(Paragraph(
        "<b>Pourquoi cette rigueur</b> : la liste des tâches alimente "
        "ensuite le contexte du PV. Si 5 tâches sur 10 sont marquées "
        "<font face='Courier'>partial</font> ou "
        "<font face='Courier'>skipped</font> avec des raisons, le builder "
        "PV peut générer une phrase honnête pour la section « Difficultés "
        "rencontrées » au lieu d'une formule générique.", s["callout"]))

    story.append(PageBreak())

    # ╠═════════════════════════════════════════════════════════════════
    # 6. Synthèse intégration
    # ╠═════════════════════════════════════════════════════════════════
    story.append(Paragraph("⑥ Intégration croisée des 5 modules", s["h1"]))

    story.append(Paragraph(
        "L'intérêt principal de ces 5 sous-modules réside dans leur "
        "<b>convergence sur le PV</b>. Lorsque le secrétaire lance la "
        "génération, l'endpoint <font face='Courier'>"
        "GET /api/meeting-pv/event-context/{eventId}</font> agrège :",
        s["body"]))

    conv = [
        "<b>Depuis Event</b> — titre, format, date, lieu, capacité, statut.",
        "<b>Depuis RSVP</b> — nombre d'inscrits confirmés.",
        "<b>Depuis le QR-scan</b> — nombre de présents réels (donc taux).",
        "<b>Depuis Task</b> — liste des tâches avec leur outcome / reason "
        "→ alimente la section « déroulement / difficultés ».",
        "<b>Depuis BorrowedItem + Devis validés</b> — récap budget réel "
        "→ alimente la section « moyens mobilisés ».",
        "<b>Depuis EventFeedback</b> — moyennes par dimension + "
        "commentaires (passés ensuite au classifieur de sentiment) "
        "→ alimente la section « clôture / bilan ».",
    ]
    for b in conv:
        story.append(Paragraph("• " + b, s["bullet"]))

    story.append(Paragraph(
        "Cette agrégation est ce qui permet au PV de contenir des "
        "<b>chiffres réels et vérifiables</b> sans que le secrétaire ne les "
        "ressaisisse — et empêche toute réécriture créative côté IA "
        "(qui reçoit ces nombres en entrée typée, pas en texte libre).",
        s["callout"]))

    # Récapitulatif final
    story.append(Paragraph("Récapitulatif des collections MongoDB", s["h2"]))
    coll = [
        ["Collection", "Volumétrie attendue", "Source d'écriture"],
        ["events", "1 doc par événement physique",
         "Calendar UI (organisateurs)"],
        ["tasks", "5 à 30 docs par événement",
         "Kanban UI (responsables)"],
        ["borrowed_items", "1 à 10 docs par événement",
         "Logistique UI"],
        ["devis", "≥ 3 docs par borrowed_item validé",
         "Saisie + extraction PDF"],
        ["lenders", "1 doc par fournisseur récurrent",
         "Auto-upsert lors de la validation devis"],
        ["meeting_pvs", "1 doc par événement clos",
         "Wizard PV (secrétaire)"],
        ["event_feedbacks", "0..N docs par événement",
         "Form attendees"],
    ]
    story.append(make_table(coll, col_widths=[4.0*cm, 5.5*cm, 7.5*cm]))

    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "Ces 7 collections + les modules d'IA décrits dans le rapport "
        "complémentaire constituent la totalité du module Event Management.",
        s["body"]))

    doc.build(story, onFirstPage=page_footer, onLaterPages=page_footer)


# ── Main ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    out1 = "rapport_ia_validation_technique.pdf"
    out2 = "rapport_evenements_besoins_devis_pv_taches.pdf"
    build_report_ia(out1)
    print(f"OK -> {out1}")
    build_report_workflow(out2)
    print(f"OK -> {out2}")
