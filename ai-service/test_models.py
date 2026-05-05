"""
Direct CLI tester for the ClubHub AI models — NO API, NO Backend, NO Gateway.

Run it as a plain Python script from the ``ai-service`` folder:

    # Recommandations (dataset synthétique de démo)
    python test_models.py reco
    python test_models.py reco --synth 30           # plus d'événements
    python test_models.py reco --dataset events.json

    # Génération de PV (exemple codé en dur, tout en français)
    python test_models.py pv

    # Les deux à la suite (idéal pour la soutenance)
    python test_models.py all

Le script importe ``app.custom.recommender`` et ``app.custom.pv_builder`` sans
passer par un serveur web — ce qui permet de montrer au jury que les modèles
existent et fonctionnent indépendamment du reste de l'architecture.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Windows console defaults to cp1252, which cannot encode ✓ / → / —.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from app.custom import pv_builder, recommender  # noqa: E402
from train_recommender import _synth_dataset  # réutilise le générateur synthétique


# ── Helpers d'affichage ─────────────────────────────────────────────────


def _title(txt: str) -> None:
    bar = "═" * (len(txt) + 4)
    print(f"\n{bar}\n  {txt}\n{bar}")


def _section(txt: str) -> None:
    print(f"\n── {txt} " + "─" * max(0, 60 - len(txt)))


# ── Commande : reco ─────────────────────────────────────────────────────


def cmd_reco(args: argparse.Namespace) -> int:
    """Exerce directement le recommender scikit-learn."""
    _title("Recommandations d'événements — modèle maison (scikit-learn)")

    if args.dataset:
        with open(args.dataset, "r", encoding="utf-8") as fp:
            facts = json.load(fp)
        print(f"Dataset chargé : {args.dataset}  ({len(facts)} événements)")
    else:
        facts = _synth_dataset(args.synth)
        print(f"Dataset synthétique : {len(facts)} événements générés en mémoire.")

    result = recommender.recommend(facts)

    _section("Méta")
    print(f"  source           : {result['source']}")
    print(f"  model            : {result['model']}")
    print(f"  totalPastEvents  : {result['totalPastEvents']}")

    _section("Format suggéré pour le prochain événement")
    print(f"  → {result['suggestedFormat']}")

    _section("Top formats (extrait)")
    for row in result["topFormats"][:3]:
        print(
            f"  • {row['format']:<14s} score={row['score']:>5}/100  "
            f"présence={int(row['avgAttendanceRate']*100):>3}%  "
            f"feedback={row['avgFeedback']}  "
            f"n={row['totalEvents']}  ({row['confidence']})"
        )
        print(f"      ↳ {row['rationale']}")

    _section("Créneau suggéré")
    t = result["suggestedTiming"]
    if t:
        print(f"  {t['dayOfWeek']} — {t['timeOfDay']} (vers {t['typicalHour']}h)")
        print(f"  prochaine date proposée : {t['suggestedDate']}")
        print(f"  score = {t['score']}/100  —  {t['confidence']}")
        print(f"  {t['rationale']}")

    _section("Staff suggéré")
    for s in result["suggestedStaff"][:3]:
        print(f"  • {s.get('name','—')}  ({s.get('role','—')})")

    _section("Insights (explicabilité du modèle)")
    for line in result["insights"]:
        print(f"  • {line}")

    _section("Actions suggérées")
    for line in result["nextActions"]:
        print(f"  → {line}")

    if result.get("caveats"):
        _section("Avertissements")
        for line in result["caveats"]:
            print(f"  ! {line}")

    if args.json:
        print("\n--- JSON brut ---")
        print(json.dumps(result, indent=2, ensure_ascii=False))

    return 0


# ── Commande : pv ───────────────────────────────────────────────────────


def _demo_context() -> tuple[dict, list[dict], str]:
    """Contexte événement + réponses secrétaire, prêts à être passés au PV builder."""
    ctx = {
        "title": "Atelier React pour débutants",
        "startDate": "2025-11-08T14:00",
        "endDate": "2025-11-08T17:00",
        "location": {"name": "Salle B-201", "address": "Campus Manouba"},
        "format": "workshop",
        "capacity": 40,
        "staff": [
            {"name": "Rania Ben Amor", "role": "speaker"},
            {"name": "Ahmed K.", "role": "moderator"},
        ],
        "attendance": {
            "confirmed": 33, "checkedIn": 31, "noShows": 2,
            "totalRsvps": 33, "fillRatePct": 77, "attendanceRatePct": 77,
        },
        "tasks": {
            "total": 5, "done": 4, "inProgress": 1, "todo": 0,
            "success": 4, "partial": 1, "skipped": 0, "completionRatePct": 80,
        },
        "borrowedItems": {"count": 0, "items": []},
        "feedback": {
            "count": 10,
            "avgOrganization": 4.3, "avgContent": 4.1, "avgAnimation": 4.2,
            "avgVenue": 4.0, "avgSchedule": 3.9, "avgNps": 8.2,
            "topTags": [{"tag": "clear", "count": 5}, {"tag": "useful", "count": 4}],
            "comments": [
                "Super atelier, très clair du début à la fin.",
                "Un peu long mais utile.",
                "J'ai adoré, je recommande.",
            ],
        },
    }

    qa = [
        {"section": "préambule", "type": "freetext",
         "question": "Mot d'ouverture du président",
         "answer": "Bienvenue à tous, merci d'être venus si nombreux."},
        {"section": "déroulement", "type": "yesno",
         "question": "Le programme a-t-il été respecté ?",
         "answer": "OUI"},
        {"section": "déroulement", "type": "yesno",
         "question": "Le matériel était-il disponible ?",
         "answer": "NON",
         "explanation": "Un projecteur est tombé en panne 20 min avant le début."},
        {"section": "décisions", "type": "freetext",
         "question": "Décision principale",
         "answer": "Reconduire l'atelier en février."},
        {"section": "plan d'action", "type": "freetext",
         "question": "Prochaines étapes",
         "answer": "Publier le support sur le Drive, envoyer un sondage aux participants."},
    ]

    notes = "Le second projecteur a été récupéré auprès de la Salle A."
    return ctx, qa, notes


def cmd_pv(_args: argparse.Namespace) -> int:
    """Exerce directement le pipeline NLP déterministe de génération de PV."""
    _title("Génération de PV — pipeline NLP déterministe (règles + lexique)")

    ctx, qa, notes = _demo_context()

    print("Données d'entrée (résumé) :")
    print(f"  événement : {ctx['title']} — {ctx['startDate']}")
    print(f"  présence  : {ctx['attendance']['checkedIn']}/"
          f"{ctx['attendance']['confirmed']} ({ctx['attendance']['attendanceRatePct']}%)")
    print(f"  réponses  : {len(qa)} (oui/non + texte libre)\n")

    pv = pv_builder.build_pv(ctx, qa, notes)

    _section("PV généré (français)")
    print(pv)
    return 0


# ── Commande : all ──────────────────────────────────────────────────────


def cmd_all(args: argparse.Namespace) -> int:
    code1 = cmd_reco(args)
    code2 = cmd_pv(args)
    return code1 or code2


# ── CLI ─────────────────────────────────────────────────────────────────


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("reco", help="Test du recommender (scikit-learn).")
    r.add_argument("--synth", type=int, default=20,
                   help="Taille du dataset synthétique (défaut 20).")
    r.add_argument("--dataset", help="Chemin vers un JSON d'événements réels.")
    r.add_argument("--json", action="store_true",
                   help="Imprime aussi la réponse JSON brute en fin de sortie.")
    r.set_defaults(func=cmd_reco)

    v = sub.add_parser("pv", help="Test du PV builder (NLP à règles).")
    v.set_defaults(func=cmd_pv)

    a = sub.add_parser("all", help="Enchaîne reco + pv (démo complète).")
    a.add_argument("--synth", type=int, default=20)
    a.add_argument("--dataset", default=None)
    a.add_argument("--json", action="store_true")
    a.set_defaults(func=cmd_all)

    args = p.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
