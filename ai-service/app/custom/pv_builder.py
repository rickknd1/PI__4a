"""
Rule-based French PV (procès-verbal) generator.

This module is the "small NLP model" side of the custom-AI story: it
ingests the exact same structured context the Java side hands over to
the LLM (event meta-data, measured attendance, tasks, feedback, and the
secretary's Q&A answers), and emits a polished 5-section French PV —
without a single LLM call.

Design:
  * Language-agnostic inputs (answers may be French / English / Arabic /
    Tunisian darija). We never translate text we don't own: if the
    secretary wrote the explanation in darija, we keep it verbatim,
    bracketed by a short French framing sentence.
  * Yes / No questions are reformulated with a small lexicon of
    positive / negative verb templates per keyword (programme,
    intervenants, matériel, budget…), so a "Oui — programme respecté"
    becomes a complete sentence ("Le programme prévu a été intégralement
    respecté."). Unknown keys fall back to a neutral construction.
  * A miniature sentiment classifier (word-list based, FR+EN) scores
    free comments so the Clôture section can say "bilan positif" /
    "retours mitigés" / "bilan à améliorer" without inventing numbers.
  * The builder reuses the real numbers verbatim (presence, rates,
    feedback averages) — no hallucination possible.

The output matches the format that `PvAiService.fallbackTemplate`
already produces (`=== PRÉAMBULE ===` headers etc.), so the Angular
preview renders it with zero changes.
"""

from __future__ import annotations

import re
from datetime import datetime
import joblib
from pathlib import Path

# ── ML Models Loading ──────────────────────────────────────────────────
_HERE = Path(__file__).resolve().parent
_SENTIMENT_MODEL_PATH = _HERE / "models" / "pv_sentiment.pkl"
_INTENT_MODEL_PATH = _HERE / "models" / "pv_intent.pkl"

try:
    SENTIMENT_MODEL = joblib.load(_SENTIMENT_MODEL_PATH)
except Exception:
    SENTIMENT_MODEL = None

try:
    INTENT_MODEL = joblib.load(_INTENT_MODEL_PATH)
except Exception:
    INTENT_MODEL = None

# ── Sentiment lexicons (tiny, domain-tuned) ─────────────────────────────

POSITIVE_WORDS = {
    # French
    "bon", "bien", "super", "génial", "excellent", "parfait", "top",
    "réussi", "positif", "intéressant", "enrichissant", "apprécié",
    "utile", "pertinent", "motivant", "dynamique", "clair",
    # English
    "great", "good", "excellent", "nice", "helpful", "useful", "clear",
    "insightful", "engaging", "awesome", "loved", "recommend",
}

NEGATIVE_WORDS = {
    # French
    "mauvais", "nul", "ennuyeux", "décevant", "lent", "long",
    "compliqué", "confus", "raté", "problème", "souci", "bug",
    "manque", "trop", "insuffisant", "désorganisé",
    # English
    "bad", "boring", "confusing", "late", "slow", "disappointing",
    "disorganized", "issue", "problem", "missing",
}


# ── Yes/No reformulation templates ──────────────────────────────────────
#
# Each entry maps a keyword (matched on the question text, case-insensitive)
# to two French sentences: the affirmation (OUI) and the passive negation
# (NON without explanation). This avoids the generic "X → OUI" rendering
# that the old fallback produced and reads like a human-written PV.

YESNO_TEMPLATES = [
    ("programme",    "Le programme prévu a été intégralement respecté.",
                     "Le programme prévu n'a pas pu être tenu dans son intégralité."),
    ("agenda",       "L'ordre du jour a été respecté dans son ensemble.",
                     "L'ordre du jour n'a pas été tenu comme prévu."),
    ("horaire",      "L'événement a débuté et s'est terminé aux horaires annoncés.",
                     "Des écarts significatifs par rapport aux horaires annoncés ont été constatés."),
    ("ponctualit",   "La ponctualité a été satisfaisante.",
                     "La ponctualité n'a pas été au rendez-vous."),
    ("intervenant",  "Tous les intervenants prévus étaient présents.",
                     "Un ou plusieurs intervenants n'ont pas pu assurer leur prestation."),
    ("speaker",      "Tous les intervenants prévus étaient présents.",
                     "Un ou plusieurs intervenants n'ont pas pu assurer leur prestation."),
    ("animateur",    "Les animateurs ont assuré l'encadrement comme prévu.",
                     "L'encadrement prévu n'a pas pu être entièrement assuré."),
    ("matériel",     "Le matériel requis était disponible et en état de fonctionnement.",
                     "Des problèmes de matériel ont perturbé le déroulement."),
    ("materiel",     "Le matériel requis était disponible et en état de fonctionnement.",
                     "Des problèmes de matériel ont perturbé le déroulement."),
    ("budget",       "Le budget alloué a été respecté.",
                     "Le budget prévisionnel n'a pas pu être respecté."),
    ("sponsor",      "Les sponsors prévus étaient présents et visibles.",
                     "La présence des sponsors n'a pas été conforme aux attentes."),
    ("sécurité",     "Le dispositif de sécurité a fonctionné correctement.",
                     "Des manquements de sécurité ont été relevés."),
    ("securite",     "Le dispositif de sécurité a fonctionné correctement.",
                     "Des manquements de sécurité ont été relevés."),
    ("communication", "La communication préalable a atteint sa cible.",
                      "La communication préalable aurait pu être plus efficace."),
    ("salle",        "La salle était adaptée à l'événement.",
                     "La salle s'est révélée inadaptée à l'événement."),
    ("lieu",         "Le lieu retenu a convenu aux besoins de l'événement.",
                     "Le lieu retenu n'a pas pleinement répondu aux besoins."),
    ("feedback",     "Les retours participants ont été majoritairement favorables.",
                     "Les retours participants ont fait état de plusieurs points à améliorer."),
    ("rangement",    "La restitution du matériel et le rangement ont été assurés.",
                     "La restitution du matériel n'a été que partiellement assurée."),
]

# Generic yes/no variants used when no keyword template matches. Rotated
# by the index of the Q&A inside its section, so a secretary who answers
# "Oui" 6 times in a row doesn't get 6 identical sentences.
GENERIC_YES_VARIANTS = [
    "Sur ce point, la réponse est affirmative.",
    "Ce volet ne présente pas de difficulté particulière.",
    "La situation est conforme aux attentes.",
    "Ce point a également été validé sans réserve.",
    "Aucune remarque particulière n'a été formulée sur ce volet.",
]
GENERIC_NO_VARIANTS = [
    "Sur ce point, la réponse est négative.",
    "Ce volet n'a pas été couvert comme attendu.",
    "Une difficulté a été relevée à ce sujet.",
    "Ce point appellera un suivi particulier.",
    "Une remarque de réserve a été formulée sur ce volet.",
]


# ── Free-text reformulation templates ───────────────────────────────────
#
# Each entry maps a keyword (matched on the question text, case-insensitive)
# to a narrative French sentence. The raw answer is inlined via placeholders:
#
#   {A}       → answer, first letter UPPER, trailing period added
#   {A_nofp}  → answer, first letter UPPER, trailing period STRIPPED
#                (useful inside French quotation marks « ... »)
#   {a}       → answer, first letter lower, trailing period added
#                (useful after "…sont : " / "…a décidé de …")
#   {a_nofp}  → answer, first letter lower, trailing period stripped
#
# The goal: never emit "Question : Answer" style. The secretary's answer
# is woven into a full French sentence that reads like prose.
FREETEXT_TEMPLATES = [
    # ── Préambule / ouverture ───────────────────────────────────────
    ("mot de bienvenue",
        "Un mot de bienvenue a été adressé aux participants : « {A_nofp} »."),
    ("allocution",
        "Lors de l'allocution d'ouverture, il a notamment été souligné : « {A_nofp} »."),
    ("mot d'ouverture",
        "En ouverture de séance, le président s'est exprimé en ces termes : « {A_nofp} »."),
    ("ouverture",
        "En ouverture de séance, le président s'est exprimé en ces termes : « {A_nofp} »."),

    # ── Décisions ───────────────────────────────────────────────────
    ("décision principale",
        "La décision principale retenue lors de cette séance est la suivante : {a}"),
    ("decision principale",
        "La décision principale retenue lors de cette séance est la suivante : {a}"),
    ("décision secondaire",
        "Une décision complémentaire a également été actée : {a}"),
    ("decision secondaire",
        "Une décision complémentaire a également été actée : {a}"),
    ("décisions prises",
        "Les décisions suivantes ont été adoptées : {a}"),
    ("décision",
        "Une décision a été actée sur ce point : {a}"),
    ("decision",
        "Une décision a été actée sur ce point : {a}"),
    ("vote",
        "Le vote a porté sur le point suivant : {a}"),

    # ── Plan d'action ───────────────────────────────────────────────
    ("prochaines étapes",
        "Les prochaines étapes convenues sont : {a}"),
    ("prochaine étape",
        "Les prochaines étapes convenues sont : {a}"),
    ("étape suivante",
        "L'étape suivante identifiée est : {a}"),
    ("action de suivi",
        "Les actions de suivi définies sont : {a}"),
    ("actions à mener",
        "Les actions à mener sont : {a}"),
    ("action",
        "Les actions à mener sont : {a}"),
    ("responsabl",
        "La répartition des responsabilités est la suivante : {a}"),
    ("echéance",
        "Les échéances fixées sont : {a}"),
    ("échéance",
        "Les échéances fixées sont : {a}"),
    ("deadline",
        "Les échéances fixées sont : {a}"),

    # ── Déroulement ─────────────────────────────────────────────────
    ("intervenant",
        "Sont intervenus au cours de la séance : {a}"),
    ("animateur",
        "L'animation a été assurée par : {a}"),
    ("présentateur",
        "La présentation a été assurée par : {a}"),
    ("qui a présenté",
        "La présentation a été assurée par : {a}"),
    ("présenté par",
        "La présentation a été assurée par : {a}"),
    ("participant",
        "Les participants à la séance étaient : {a}"),
    ("présence",
        "Concernant les présences, il a été relevé : {a}"),
    ("absent",
        "Concernant les absences, il a été relevé : {a}"),
    ("excusé",
        "Les personnes excusées sont : {a}"),
    ("déroulement",
        "Le déroulement a été le suivant : {a}"),
    ("ordre du jour",
        "L'ordre du jour traité a été le suivant : {a}"),

    # ── Clôture / bilan ────────────────────────────────────────────
    ("bilan",
        "Le bilan tiré de cette séance est le suivant : {a}"),
    ("problème",
        "Les difficultés rencontrées sont les suivantes : {a}"),
    ("probleme",
        "Les difficultés rencontrées sont les suivantes : {a}"),
    ("difficult",
        "Les difficultés rencontrées sont les suivantes : {a}"),
    ("suggestion",
        "Les suggestions formulées sont : {a}"),
    ("recommandation",
        "Les recommandations émises sont : {a}"),
    ("remarque",
        "Les remarques consignées sont : {a}"),
    ("commentaire",
        "Les commentaires recueillis sont : {a}"),
    ("note additionnelle",
        "Il convient également de noter que {a}"),
    ("note",
        "Il est à noter que {a}"),
    ("contexte",
        "Pour rappel, {a}"),
    ("retour participant",
        "Les retours recueillis auprès des participants sont : {a}"),
    ("retour",
        "Les retours recueillis sont : {a}"),
    ("point fort",
        "Parmi les points forts de la séance, il ressort : {a}"),
    ("point faible",
        "Parmi les points à améliorer, il ressort : {a}"),
    ("point à améliorer",
        "Parmi les points à améliorer, il ressort : {a}"),
]


# ── Public entry point ──────────────────────────────────────────────────

def build_pv(ctx: dict[str, Any],
             qa_pairs: list[dict[str, Any]] | None,
             additional_notes: str | None = None) -> str:
    """Assemble a French PV from the structured event context + Q&A answers.

    `ctx` is the dict produced by `EventContextService.buildContext(event)`
    on the Java side. `qa_pairs` is a list of
    `{ section, question, answer, explanation, type }` items.
    """
    qa_pairs = qa_pairs or []
    sections_qa = _group_by_section(qa_pairs)

    title = _get(ctx, "title", "l'événement")
    start = _fmt_date(_get(ctx, "startDate"))
    end = _get(ctx, "endDate")
    location = _get(_get(ctx, "location") or {}, "name", "Lieu non précisé")
    address = _get(_get(ctx, "location") or {}, "address", "")
    fmt = _get(ctx, "format", "format non précisé")
    capacity = _get(ctx, "capacity", 0)

    staff = _get(ctx, "staff") or []
    attendance = _get(ctx, "attendance") or {}
    tasks = _get(ctx, "tasks") or {}
    borrowed = _get(ctx, "borrowedItems") or {}
    feedback = _get(ctx, "feedback") or {}

    lines: list[str] = []
    # Mutable counter shared across section renderers so the rotation of
    # generic "Oui" variants carries through the whole document.
    yesno_counter: list[int] = [0]

    # ── 1. PRÉAMBULE ──────────────────────────────────────────────────
    lines.append("=== PRÉAMBULE ===")
    preambule = (
        f"Le présent procès-verbal documente le déroulement de "
        f"l'événement « {title} », organisé le {start}"
    )
    if end and str(end) != "—":
        preambule += f" (clôture : {_fmt_date(end)})"
    preambule += f" à {location}"
    if address:
        preambule += f" ({address})"
    if fmt and fmt != "format non précisé":
        preambule += f", au format {fmt}"
    if capacity:
        preambule += f", avec une capacité d'accueil de {capacity} personnes"
    preambule += "."
    lines.append(preambule)
    lines.extend(_render_qa_block(sections_qa.get("préambule", []), counter=yesno_counter))
    lines.append("")

    # ── 2. DÉROULEMENT ────────────────────────────────────────────────
    lines.append("=== DÉROULEMENT ===")
    if staff:
        names = ", ".join(
            f"{s.get('name','—')}" + (f" ({s.get('role')})" if s.get("role") else "")
            for s in staff
        )
        lines.append(f"L'équipe encadrante était constituée de : {names}.")
    confirmed = _num(attendance.get("confirmed"))
    checked = _num(attendance.get("checkedIn"))
    no_shows = _num(attendance.get("noShows"))
    att_rate = _num(attendance.get("attendanceRatePct"))
    fill_rate = _num(attendance.get("fillRatePct"))
    checked_phrase = _fr_plural(
        checked,
        "personne effectivement présente",
        "personnes effectivement présentes",
    )
    confirmed_phrase = _fr_plural(
        confirmed, "inscription confirmée", "inscriptions confirmées",
    )
    lines.append(
        f"L'événement a réuni {checked_phrase} sur {confirmed_phrase}, "
        f"soit un taux de présence de {att_rate}%{_fill_suffix(fill_rate)}."
    )
    if _int(no_shows) > 0:
        no_show_phrase = _fr_plural(
            no_shows,
            "personne inscrite ne s'est pas présentée",
            "personnes inscrites ne se sont pas présentées",
        )
        lines.append(f"À noter que {no_show_phrase}.")
    lines.extend(_render_qa_block(sections_qa.get("déroulement", []), counter=yesno_counter))
    lines.append("")

    # ── 3. DÉCISIONS ──────────────────────────────────────────────────
    lines.append("=== DÉCISIONS ===")
    decisions = _render_qa_block(sections_qa.get("décisions", []), counter=yesno_counter)
    if decisions:
        lines.extend(decisions)
    else:
        lines.append("Aucune décision formelle n'a été actée lors de cette séance.")
    lines.append("")

    # ── 4. PLAN D'ACTION ──────────────────────────────────────────────
    lines.append("=== PLAN D'ACTION ===")
    t_total = _num(tasks.get("total"))
    t_done = _num(tasks.get("done"))
    t_progress = _num(tasks.get("inProgress"))
    t_todo = _num(tasks.get("todo"))
    t_rate = _num(tasks.get("completionRatePct"))
    if _int(t_total) > 0:
        total_phrase = _fr_plural(t_total, "tâche planifiée", "tâches planifiées")
        lines.append(
            f"Sur {total_phrase}, {t_done} ont été menées à terme, "
            f"{t_progress} sont en cours et {t_todo} restent à démarrer "
            f"(taux d'achèvement : {t_rate}%)."
        )
    task_plan = _render_qa_block(sections_qa.get("plan d'action", []), counter=yesno_counter)
    if task_plan:
        lines.extend(task_plan)
    b_count = _int(borrowed.get("count"))
    if b_count > 0:
        borrowed_phrase = _fr_plural(
            b_count,
            "article de matériel emprunté est à restituer",
            "articles de matériel empruntés sont à restituer",
        )
        lines.append(f"{borrowed_phrase} aux prêteurs concernés.")
    if not task_plan and int(t_total or 0) == 0:
        lines.append("Aucune action de suivi n'a été formellement assignée.")
    lines.append("")

    # ── 5. CLÔTURE ────────────────────────────────────────────────────
    lines.append("=== CLÔTURE ===")
    fb_count = _num(feedback.get("count"))
    avg_org = feedback.get("avgOrganization")
    avg_content = feedback.get("avgContent")
    avg_anim = feedback.get("avgAnimation")
    comments = feedback.get("comments") or []
    sentiment_label = _sentiment_label(comments,
                                       avg_org=avg_org,
                                       avg_content=avg_content,
                                       avg_anim=avg_anim)
    if _int(fb_count) > 0:
        fb_phrase = _fr_plural(
            fb_count, "retour participant", "retours participants",
        )
        lines.append(
            f"Sur {fb_phrase}, la note moyenne d'organisation s'établit "
            f"à {avg_org or '—'}/5, le contenu à {avg_content or '—'}/5 "
            f"et l'animation à {avg_anim or '—'}/5 — le bilan global "
            f"est {sentiment_label}."
        )
    else:
        lines.append(
            "Aucun retour formel participant n'a été collecté pour cette édition."
        )
    lines.extend(_render_qa_block(sections_qa.get("clôture", []), counter=yesno_counter))
    if additional_notes and additional_notes.strip():
        lines.append(f"Note complémentaire du secrétaire : {additional_notes.strip()}")
    lines.append("")
    lines.append("Le secrétaire de séance,")
    lines.append("____________________")

    return "\n".join(lines)


# ── Internal helpers ────────────────────────────────────────────────────

def _group_by_section(qa_pairs: list[dict[str, Any]]) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for p in qa_pairs:
        sec = (p.get("section") or "").strip().lower()
        out.setdefault(sec, []).append(p)
    return out


def _render_qa_block(pairs: list[dict[str, Any]],
                     *, counter: list[int] | None = None) -> list[str]:
    """Render a list of Q&A pairs as narrative French sentences.

    Two safeguards make the output readable even when the secretary
    answers "Oui" to a long list of similar questions:

      1. Generic yes/no replies are **rotated** across a pool of variants
         (counter ``generic_idx``) so we never emit the same sentence
         twice in a row.
      2. Consecutive exact duplicates are filtered out: if the previous
         emitted sentence is identical to the new one, we skip it.

    ``counter`` is an optional 1-element list used as a mutable counter
    shared across sections — this way a secretary who answered "Oui" to
    8 questions across 5 sections will see 5 different wordings instead
    of restarting from variant 0 in each section.
    """
    out: list[str] = []
    if counter is None:
        counter = [0]
    for p in pairs:
        answer = (p.get("answer") or "").strip()
        explanation = (p.get("explanation") or "").strip()
        if not answer and not explanation:
            continue
        if (p.get("type") or "").lower() == "yesno":
            sentence, used_generic = _reformulate_yesno(
                p.get("question") or "", answer, explanation,
                generic_idx=counter[0],
            )
            if used_generic:
                counter[0] += 1
        else:
            sentence = _reformulate_freetext(p.get("question") or "", answer)
        if not sentence:
            continue
        if out and out[-1] == sentence:
            continue
        out.append(sentence)
    return out


def _reformulate_yesno(question: str, answer: str, explanation: str,
                       *, generic_idx: int = 0) -> tuple[str, bool]:
    """Turn a yes/no Q&A into a French sentence.

    Returns ``(sentence, used_generic)`` — ``used_generic`` is True when
    we had to fall back to the rotating generic pool, which the caller
    uses to advance its rotation counter.
    """
    ans = (answer or "").strip().upper()
    q_lower = (question or "").lower()
    matched_keyword = False
    yes_tpl = GENERIC_YES_VARIANTS[generic_idx % len(GENERIC_YES_VARIANTS)]
    no_tpl = GENERIC_NO_VARIANTS[generic_idx % len(GENERIC_NO_VARIANTS)]

    # ── Tier 1: Intent Classifier (ML) ──────────
    if INTENT_MODEL and q_lower.strip():
        try:
            # Predict the "keyword" intent
            intent = str(INTENT_MODEL.predict([q_lower])[0])
            for keyword, yes, no in YESNO_TEMPLATES:
                if keyword == intent:
                    yes_tpl, no_tpl = yes, no
                    matched_keyword = True
                    break
        except Exception:
            pass

    # ── Tier 2: Keyword Matching Fallback ──────────
    if not matched_keyword:
        for keyword, yes, no in YESNO_TEMPLATES:
            if keyword in q_lower:
                yes_tpl, no_tpl = yes, no
                matched_keyword = True
                break

    if ans == "OUI":
        return yes_tpl, not matched_keyword
    if ans == "NON":
        if explanation:
            return f"{no_tpl} Le secrétaire précise : « {explanation} ».", not matched_keyword
        return no_tpl, not matched_keyword
    if ans in {"SANS AVIS", "N/A", "-", ""}:
        return "", False
    return f"Concernant « {question} », la réponse indiquée est : {answer}.", False


def _reformulate_freetext(question: str, answer: str) -> str:
    """Turn a free-text Q&A into a narrative French sentence.

    Pipeline:
      1. Try to match a keyword from ``FREETEXT_TEMPLATES`` against the
         question text (case-insensitive). If we find one, weave the
         answer into the corresponding narrative template.
      2. Otherwise, fall back to emitting the answer as a standalone
         sentence (no "Question : Answer" pattern is ever produced).

    This is what lets the PV read like a real report written by a human
    secretary rather than a form dump.
    """
    if not answer:
        return ""
    q = (question or "").lower()

    variants = _answer_variants(answer)

    for keyword, template in FREETEXT_TEMPLATES:
        if keyword in q:
            return template.format(**variants)

    # ── Generic fallback ────────────────────────────────────────────
    # No known template matched — drop the question entirely and render
    # the answer as a standalone, well-punctuated French sentence.
    return variants["A"]


def _answer_variants(answer: str) -> dict[str, str]:
    """Prepare the 4 placeholder forms used by ``FREETEXT_TEMPLATES``.

    See the module-level docstring near ``FREETEXT_TEMPLATES`` for the
    meaning of each form.
    """
    a = (answer or "").strip()
    if not a:
        return {"A": "", "A_nofp": "", "a": "", "a_nofp": ""}

    nofp = a.rstrip(".!?").strip()
    if not nofp:
        return {"A": a, "A_nofp": a, "a": a, "a_nofp": a}

    A_nofp = nofp[0].upper() + nofp[1:]
    a_nofp = nofp[0].lower() + nofp[1:]
    A = A_nofp + "."
    a_low = a_nofp + "."

    return {"A": A, "A_nofp": A_nofp, "a": a_low, "a_nofp": a_nofp}


def _sentiment_label(comments: list[str], *,
                     avg_org: Any, avg_content: Any, avg_anim: Any) -> str:
    """Combine the numeric averages and the free-text comments into a label.
    
    Now uses a trained Logistic Regression model (Tier 1) with a fallback
    to word-list heuristics (Tier 2).
    """
    scores = [x for x in (avg_org, avg_content, avg_anim) if _is_num(x)]
    avg = sum(float(s) for s in scores) / len(scores) if scores else None

    text = " ".join(str(c).lower() for c in comments if c)
    
    # ── Tier 1: Trained ML Model ──────────
    if SENTIMENT_MODEL and text.strip():
        try:
            # Predict label (0: Neg, 1: Neut, 2: Pos)
            pred = int(SENTIMENT_MODEL.predict([text])[0])
            if pred == 2:
                # Guard against "all positive" bias: if numeric ratings are low,
                # keep a cautious wording even when text looks positive.
                if avg is not None and avg < 3.0:
                    return "mitigé (écart entre commentaires et notes)"
                if avg is not None and avg >= 4.4:
                    return "très positif"
                return "positif"
            if pred == 0:
                return "à améliorer (avis négatifs relevés)"
            if pred == 1:
                return "globalement satisfaisant (avis mitigés)"
        except Exception:
            pass

    # ── Tier 2: Heuristic Fallback (Word Lists) ──────────
    words = re.findall(r"\b\w{3,}\b", text, re.UNICODE)
    pos = sum(1 for w in words if w in POSITIVE_WORDS)
    neg = sum(1 for w in words if w in NEGATIVE_WORDS)

    if avg is not None and avg >= 4.5 and neg == 0:
        return "très positif"
    if avg is not None and avg >= 3.7 and pos >= neg + 2:
        return "positif"
    if avg is not None and avg < 3.0 and pos > neg:
        return "mitigé (écart entre notes et verbatim)"
    if avg is not None and avg < 2.5:
        return "à améliorer"
    if neg > pos + 2:
        return "mitigé (plusieurs remarques négatives)"
    if pos > neg + 2:
        return "positif"
    return "globalement satisfaisant"


# ── Tiny safe getters ──────────────────────────────────────────────────

def _get(obj: Any, key: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        v = obj.get(key)
        return v if v not in (None, "", "null") else default
    return default


def _num(v: Any) -> Any:
    """Accept Integer/Long/String from Java, return a display-safe value."""
    if v is None or v == "":
        return 0
    return v


def _int(v: Any) -> int:
    """Best-effort cast to int, defaulting to 0."""
    try:
        return int(float(v)) if v not in (None, "") else 0
    except (TypeError, ValueError):
        return 0


def _fr_plural(n: Any, singular: str, plural: str | None = None) -> str:
    """Render ``n word`` with correct French agreement.

    In French, 0 and 1 take the singular form; 2+ take the plural. We let
    the caller supply an explicit plural form when it's not just ``+s``
    (e.g. ``"personnes effectivement présentes"`` vs
    ``"personne effectivement présente"``).
    """
    count = _int(n)
    if count < 2:
        return f"{count} {singular}"
    return f"{count} {plural or singular + 's'}"


def _is_num(v: Any) -> bool:
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


def _fmt_date(iso: Any) -> str:
    if not iso:
        return "date non précisée"
    s = str(iso)
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y à %Hh%M")
    except Exception:
        return s


def _fill_suffix(fill_rate: Any) -> str:
    try:
        if int(fill_rate or 0) > 0:
            return f" (taux de remplissage : {fill_rate}%)"
    except Exception:
        pass
    return ""

