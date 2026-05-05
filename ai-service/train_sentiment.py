"""
Training CLI for the ClubHub Sentiment Analysis model.

This script trains a Logistic Regression classifier on a dataset of 
event-related comments (French/English) to replace the rule-based 
word lists in the PV generator.

Output:
    app/custom/models/pv_sentiment.pkl
"""

import os
import joblib
import sys
import numpy as np
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

# Support UTF-8 on Windows terminals
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# ── Dataset multilingue (Français / Anglais / Tunisian darija / Arabic) ─
# ~180 phrases, équilibré ~60 par classe. Couvre vocabulaire académique +
# informel + courts (5 mots) + longs (20 mots). Reproduit les nuances
# typiques de feedbacks de clubs ESPRIT : ponctualité, intervenants, salle,
# matériel, contenu pédagogique, ambiance, organisation logistique.
#
# Le dataset reste petit volontairement pour rester reproductible et
# explicable lors de la soutenance ; sur 10k lignes réelles le modèle
# gagnerait encore en robustesse mais l'architecture ne changerait pas.
DATASET = [
    # ╔══════════ POSITIF (label 2) ══════════
    # Français standard
    ("C'était vraiment super, j'ai adoré !", 2),
    ("Organisation parfaite et contenu très intéressant.", 2),
    ("Excellent atelier, très formateur.", 2),
    ("Une expérience incroyable, je recommande vivement.", 2),
    ("Top ! Merci pour l'invitation.", 2),
    ("Très bien organisé, bravo à toute l'équipe.", 2),
    ("Les intervenants étaient passionnants et accessibles.", 2),
    ("Un vrai plaisir, j'ai appris énormément de choses.", 2),
    ("Contenu riche, animation dynamique, je redemande.", 2),
    ("Atelier très enrichissant, parfaitement structuré.", 2),
    ("Présentation claire et ponctualité au rendez-vous.", 2),
    ("Format idéal, durée bien calibrée.", 2),
    ("Salle agréable, accueil chaleureux, contenu de qualité.", 2),
    ("Vraiment au top, on en redemande !", 2),
    ("Les exercices pratiques étaient exactement ce qu'il fallait.", 2),
    ("Super ambiance, j'ai rencontré des gens géniaux.", 2),
    ("Très utile pour mon stage, merci beaucoup.", 2),
    ("Intervenants compétents, clairs et bienveillants.", 2),
    ("Format hybride parfaitement maîtrisé, bravo.", 2),
    ("Dépassé mes attentes, à refaire absolument.", 2),
    # Français informel / court
    ("Génial !", 2),
    ("Stylé, bien fait.", 2),
    ("Trop bien, merci !", 2),
    ("Top top top.", 2),
    ("Que du positif.", 2),
    # English
    ("Great event, very well organized.", 2),
    ("I loved the energy and the speakers.", 2),
    ("Perfect timing and useful insights.", 2),
    ("Awesome workshop, learned a lot.", 2),
    ("Highly recommended for beginners.", 2),
    ("Best workshop I attended this semester.", 2),
    ("Speakers were inspiring and well prepared.", 2),
    ("Excellent venue and very smooth logistics.", 2),
    ("Loved the hands-on exercises, very practical.", 2),
    ("Clear content and engaging presentation.", 2),
    ("Definitely worth attending, will join again.", 2),
    ("Friendly atmosphere and great networking.", 2),
    # Tunisian darija (latin script — comme tapé en pratique)
    ("Behi barcha, mer7ba bel kol.", 2),
    ("Lwarsha kenet bel ne9a, fer7ana.", 2),
    ("3ajbetni el munadhama, top.", 2),
    ("L'event ken mzeyen, sh7al est7a9aw.", 2),
    ("Ena n7eb ne7dher kima haka events okhrin.", 2),
    ("Animateurs y9araw mli7, fhemt el kol.", 2),
    ("Tres bien organisé behi barcha.", 2),
    # Arabic script
    ("كان رائع جدا، شكرا لكم", 2),
    ("ورشة ممتازة، تعلمت الكثير", 2),
    ("التنظيم كان مثالي والمحاضرين متمكنين", 2),

    # ╔══════════ NEUTRE / MOYEN (label 1) ══════════
    ("Pas mal, mais un peu long sur la fin.", 1),
    ("Correct, mais j'attendais plus de pratique.", 1),
    ("Bien dans l'ensemble, malgré quelques soucis techniques.", 1),
    ("Sympa, mais la salle était trop petite.", 1),
    ("Intéressant, mais aurait pu être plus interactif.", 1),
    ("Bonne idée mais exécution moyenne.", 1),
    ("Contenu utile, présentation un peu plate.", 1),
    ("Ça va, sans plus.", 1),
    ("Format correct, mais le timing était serré.", 1),
    ("Sympa l'événement, dommage le décalage horaire.", 1),
    ("Bien préparé mais manquait d'exemples concrets.", 1),
    ("Pas mauvais, juste un peu trop théorique.", 1),
    ("Plutôt bien sauf quelques temps morts.", 1),
    ("Moyen, j'espérais mieux niveau intervenants.", 1),
    ("Animation correcte, salle bruyante.", 1),
    ("Sujet intéressant mais traité trop rapidement.", 1),
    ("Pas mal pour une première édition.", 1),
    ("Bon dans l'ensemble, à améliorer côté logistique.", 1),
    ("Honnêtement c'était mitigé, du bon et du moins bon.", 1),
    ("Quelques bonnes parties, d'autres ennuyeuses.", 1),
    # English
    ("It was okay, but a bit repetitive.", 1),
    ("Good content but the presentation was slow.", 1),
    ("Interesting but not enough time for questions.", 1),
    ("Average experience, could be better.", 1),
    ("Decent event, nothing special.", 1),
    ("Mixed feelings, some parts were great, others not.", 1),
    ("Fine but I expected more interaction.", 1),
    ("Could improve the venue and the schedule.", 1),
    ("Not bad, but the room was too crowded.", 1),
    ("Useful info but overall pacing was off.", 1),
    ("Okay, but I left a bit unsatisfied.", 1),
    # Darija
    ("Mech battel ama mech 3ajebni 7adhouka.", 1),
    ("Normal, ken yenajem ykoun ahsan.", 1),
    ("Behi 3al kol ama el wa9t kif tawel.", 1),
    ("Mawjouda chwaya l'organisation chwaya na9sa.", 1),
    ("Mech battel ama mahouwech li tsewerthou.", 1),
    # Arabic
    ("عادي، لا بأس به", 1),
    ("جيد لكن ينقصه التطبيق العملي", 1),

    # ╔══════════ NÉGATIF (label 0) ══════════
    ("Très déçu par l'organisation, beaucoup de retard.", 0),
    ("Contenu sans intérêt et mal présenté.", 0),
    ("Perte de temps totale, je ne reviendrai pas.", 0),
    ("Grosse confusion sur le lieu et l'horaire.", 0),
    ("Mauvaise ambiance, intervenants peu motivés.", 0),
    ("Vraiment décevant, je m'attendais à beaucoup mieux.", 0),
    ("Catastrophe d'organisation, salle introuvable.", 0),
    ("Intervenant qui lisait son slide, niveau zéro.", 0),
    ("L'événement a commencé avec une heure de retard.", 0),
    ("Salle minuscule pour le nombre d'inscrits, étouffant.", 0),
    ("Aucun support fourni, on a rien retenu.", 0),
    ("Sujet intéressant gâché par une mauvaise animation.", 0),
    ("Ennuyeux du début à la fin.", 0),
    ("Beaucoup de problèmes techniques, micro qui coupe.", 0),
    ("Pas du tout au niveau des promesses du flyer.", 0),
    ("Communication désastreuse, aucun rappel envoyé.", 0),
    ("Le speaker n'a pas répondu aux questions.", 0),
    ("Mal préparé, ça se voyait dès le début.", 0),
    ("Annulé sans prévenir et reprogrammé n'importe comment.", 0),
    ("Une honte vu le prix de l'inscription.", 0),
    # Court
    ("Nul.", 0),
    ("Décevant.", 0),
    ("Bof.", 0),
    ("Pas du tout convaincu.", 0),
    # English
    ("Bad organization, too much delay.", 0),
    ("Disappointing content, not what I expected.", 0),
    ("Waste of time, very disorganized.", 0),
    ("Confusing and boring.", 0),
    ("The speakers were not prepared at all.", 0),
    ("Worst workshop I attended, very poor.", 0),
    ("Started 45 minutes late, no apology.", 0),
    ("Room was way too small and noisy.", 0),
    ("Speakers read slides, no real engagement.", 0),
    ("Audio kept cutting, frustrating experience.", 0),
    ("Useless, learned absolutely nothing.", 0),
    ("Poorly organized and lazy presentation.", 0),
    # Darija
    ("Khasara wa9t.", 0),
    ("Mahch behi, organisation faible barcha.", 0),
    ("L'event kif kif zero, ma 3ajebnich.", 0),
    ("Tawel barcha w el contenu pauvre.", 0),
    ("Animateurs ma 7adhrouch, kelma ma fhamtech.", 0),
    ("Chambre 3a9da, son sayeb, catastrophe.", 0),
    # Arabic
    ("سيء جدا، خيبة أمل", 0),
    ("التنظيم كان فاشل والوقت ضاع", 0),
    ("تأخر كبير ومحاضرين غير مستعدين", 0),
]

def train_sentiment_model(output_path: Path):
    print("→ Training Sentiment Analysis model...")
    
    X = [text for text, label in DATASET]
    y = [label for text, label in DATASET]
    
    # Pipeline: Vectorisation (TF-IDF) + Classifieur (Logistic Regression)
    # - ngram_range=(1, 2) capture les bi-grammes ("pas mal", "un peu long")
    #   nécessaires à la gestion de la négation.
    # - min_df=1 : on accepte les tokens qui n'apparaissent qu'une fois — le
    #   dataset reste petit et chaque exemple compte.
    # - sublinear_tf : amortit les commentaires longs où certains mots se
    #   répètent (sinon "très très très bien" surclasse "bien").
    # - class_weight='balanced' : compense les écarts d'effectif entre classes
    #   pour éviter le biais "tout positif" quand le texte est ambigu.
    pipeline = Pipeline([
        ('tfidf', TfidfVectorizer(
            ngram_range=(1, 2), min_df=1, sublinear_tf=True, lowercase=True,
            strip_accents='unicode',
        )),
        ('clf', LogisticRegression(
            max_iter=1000, class_weight='balanced', C=1.0,
        ))
    ])
    
    pipeline.fit(X, y)
    
    # Export
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, output_path)
    
    print(f"✓ Model trained on {len(X)} samples.")
    print(f"✓ Saved to: {output_path}")
    
    # Class distribution
    from collections import Counter
    dist = Counter(y)
    print(f"  Class distribution: pos={dist[2]}, neu={dist[1]}, neg={dist[0]}")

    # Smoke test — couvre français, anglais, darija, court, ambigu, négation
    test_texts = [
        "C'était génial !",
        "Trop de retard, dommage.",
        "Correct mais sans plus.",
        "Behi barcha, top!",
        "Khasara wa9t, mahch behi.",
        "Pas mal du tout, sympa.",
        "Awesome workshop, learned a lot.",
        "Boring and disorganized.",
        "Mech battel ama mahouwech 7aja.",
        "Bof.",
    ]
    preds = pipeline.predict(test_texts)
    probas = pipeline.predict_proba(test_texts)
    classes = list(pipeline.classes_)
    labels = {2: "POSITIF", 1: "NEUTRE", 0: "NÉGATIF"}

    print("\nSmoke test:")
    for txt, p, proba in zip(test_texts, preds, probas):
        conf = proba[classes.index(int(p))]
        print(f"  [{conf:.2f}] '{txt}' → {labels[int(p)]}")

if __name__ == "__main__":
    HERE = Path(__file__).resolve().parent
    OUT = HERE / "app" / "custom" / "models" / "pv_sentiment.pkl"
    train_sentiment_model(OUT)
