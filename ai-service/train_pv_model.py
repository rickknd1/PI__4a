"""
Master Training CLI for ClubHub PV Generation Models.

Trains two models:
1. Sentiment Classifier (Logistic Regression) - For feedback analysis.
2. Intent Classifier (Random Forest) - For mapping questions to PV sections.

Output:
    app/custom/models/pv_sentiment.pkl
    app/custom/models/pv_intent.pkl
"""

import os
import sys
import joblib
import numpy as np
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline

# Support UTF-8 on Windows terminals
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# ── DATASET 1: SENTIMENT (POSITIF/NEUTRE/NÉGATIF) ──────────────────────
SENTIMENT_DATA = [
    ("C'était vraiment super, j'ai adoré !", 2),
    ("Organisation parfaite et contenu très intéressant.", 2),
    ("Excellent atelier, très formateur.", 2),
    ("Une expérience incroyable, je recommande vivement.", 2),
    ("Great event, very well organized.", 2),
    ("Awesome workshop, learned a lot.", 2),
    ("Pas mal, mais un peu long sur la fin.", 1),
    ("Correct, mais j'attendais plus de pratique.", 1),
    ("It was okay, but a bit repetitive.", 1),
    ("Très déçu par l'organisation, beaucoup de retard.", 0),
    ("Contenu sans intérêt et mal présenté.", 0),
    ("Perte de temps totale, je ne reviendrai pas.", 0),
    ("Bad organization, too much delay.", 0),
]

# ── DATASET 2: INTENT (BUDGET / PROGRAMME / MATERIEL / etc.) ──────────
# Mapping the questions to the template keywords used in pv_builder.py
INTENT_DATA = [
    # Label: budget
    ("Le budget a-t-il été respecté ?", "budget"),
    ("L'argent alloué a-t-il suffi ?", "budget"),
    ("Gestion financière correcte ?", "budget"),
    ("A-t-on dépassé le budget ?", "budget"),
    ("Est-ce qu'on a assez d'argent ?", "budget"),
    ("Budget prévisionnel tenu ?", "budget"),
    ("Les finances sont ok ?", "budget"),
    
    # Label: programme
    ("Le programme a-t-il été respecté ?", "programme"),
    ("L'ordre du jour a-t-il été suivi ?", "programme"),
    ("Le planning a été tenu ?", "programme"),
    ("On a suivi l'agenda ?", "programme"),
    
    # Label: matériel
    ("Le matériel était-il disponible ?", "matériel"),
    ("Equipement en bon état ?", "matériel"),
    ("Soucis de logistique matériel ?", "matériel"),
    ("Projecteur et micros ok ?", "matériel"),
    
    # Label: horaire
    ("Démarrage à l'heure ?", "horaire"),
    ("Respect des horaires ?", "horaire"),
    ("Ponctualité ?", "horaire"),
    ("Retard à signaler ?", "horaire"),
    
    # Label: lieu
    ("La salle était-elle adaptée ?", "lieu"),
    ("Le local convenait ?", "lieu"),
    ("Espace suffisant ?", "lieu"),
    ("Lieu de l'événement ?", "lieu"),
]

def train_models():
    HERE = Path(__file__).resolve().parent
    MODELS_DIR = HERE / "app" / "custom" / "models"
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Train Sentiment Model
    print("→ Training Sentiment Analysis model...")
    X_s = [t for t, l in SENTIMENT_DATA]
    y_s = [l for t, l in SENTIMENT_DATA]
    pipe_s = Pipeline([
        ('tfidf', TfidfVectorizer(ngram_range=(1, 2))),
        ('clf', LogisticRegression(max_iter=1000))
    ])
    pipe_s.fit(X_s, y_s)
    joblib.dump(pipe_s, MODELS_DIR / "pv_sentiment.pkl")
    print("✓ Sentiment model saved.")

    # 2. Train Intent Model
    print("→ Training Intent Classifier...")
    X_i = [t for t, l in INTENT_DATA]
    y_i = [l for t, l in INTENT_DATA]
    pipe_i = Pipeline([
        ('tfidf', TfidfVectorizer(ngram_range=(1, 2))),
        ('clf', RandomForestClassifier(n_estimators=100, random_state=42))
    ])
    pipe_i.fit(X_i, y_i)
    joblib.dump(pipe_i, MODELS_DIR / "pv_intent.pkl")
    print("✓ Intent model saved.")

    # Smoke Test
    print("\nSmoke Test:")
    print(f"  'C'est génial' → {['NÉGATIF', 'NEUTRE', 'POSITIF'][pipe_s.predict(['C\'est génial'])[0]]}")
    print(f"  'Est-ce qu'on a assez d'argent ?' → {pipe_i.predict(['Est-ce qu\'on a assez d\'argent ?'])[0]}")

if __name__ == "__main__":
    train_models()
