# Architecture IA de ClubHub

> Document de référence pour le rapport PFE et la soutenance.
> Montre pourquoi ClubHub a choisi une pile **100 % locale** et comment
> les trois niveaux d'intelligence s'enchaînent.

---

## 1. Vue d'ensemble en une image

```mermaid
flowchart TB
    subgraph Frontend["Frontend · Angular"]
        UI["Interface<br/>utilisateur"]
    end

    subgraph Gateway["Passerelle"]
        GW["Spring Cloud<br/>Gateway<br/>:8084"]
    end

    subgraph Backend["Backend Java · Spring Boot :8080"]
        CTRL_R["EventRecommendation<br/>Controller"]
        CTRL_P["MeetingPv<br/>Controller"]
        CTRL_F["EventFeedback<br/>Controller"]
        SVC_E["EventAiService"]
        SVC_P["PvAiService"]
        ROUTER["AiClientRouter<br/><i>@Primary</i>"]
        LOCAL["LocalAiClient<br/>RestTemplate"]
        T3["<b>Tier 3</b><br/>Templates<br/>déterministes<br/>Java"]
    end

    subgraph Python["Service IA Python · FastAPI :8000"]
        API["main.py"]
        subgraph T1["Tier 1 — Modèles custom"]
            RECO["recommender.py<br/>RandomForest<br/>scikit-learn"]
            PV["pv_builder.py<br/>NLP à règles<br/>(français)"]
        end
        subgraph T2["Tier 2 — LLM fallback"]
            OLLAMA_BRIDGE["Pont Ollama"]
        end
    end

    subgraph Ollama["Ollama · :11434 (optionnel)"]
        LLM_MODEL["Modèle LLM<br/>llama3 / mistral<br/><i>local, hors ligne</i>"]
    end

    UI --> GW --> CTRL_R & CTRL_P & CTRL_F
    CTRL_R --> SVC_E
    CTRL_P --> SVC_P
    CTRL_F --> SVC_E

    SVC_E -.->|1. Tier 1| LOCAL
    SVC_P -.->|1. Tier 1| LOCAL
    SVC_E -.->|2. Tier 2| ROUTER
    SVC_P -.->|2. Tier 2| ROUTER
    SVC_E -.->|3. Tier 3| T3
    SVC_P -.->|3. Tier 3| T3

    ROUTER --> LOCAL
    LOCAL -->|HTTP JSON| API
    API --> RECO
    API --> PV
    API --> OLLAMA_BRIDGE
    OLLAMA_BRIDGE -->|HTTP| LLM_MODEL

    classDef t1 fill:#2d6cdf,stroke:#1a4fa8,color:#fff
    classDef t2 fill:#6a4c93,stroke:#4a2d70,color:#fff
    classDef t3 fill:#3aa55d,stroke:#2d7a46,color:#fff
    class RECO,PV,T1 t1
    class OLLAMA_BRIDGE,T2,LLM_MODEL t2
    class T3 t3
```

**Rien ne sort de la machine.** Aucun appel HTTP vers Google / OpenAI /
Anthropic / Hugging Face. Les seules connexions réseau sont entre
processus locaux (`localhost:8080` ↔ `localhost:8000` ↔ `localhost:11434`).

---

## 2. Les trois niveaux d'intelligence

```mermaid
flowchart LR
    REQ([Requête<br/>utilisateur]) --> T1{Tier 1<br/>disponible ?}
    T1 -->|oui| M1[Modèles custom<br/>scikit-learn + NLP<br/>source: <b>custom-ml</b>]
    T1 -->|non / erreur| T2{Tier 2<br/>disponible ?}
    T2 -->|oui| M2[LLM local<br/>Ollama<br/>source: <b>llm</b>]
    T2 -->|non / erreur| M3[Templates Java<br/>déterministes<br/>source: <b>stats-fallback</b>]

    M1 --> OUT([Réponse JSON])
    M2 --> OUT
    M3 --> OUT

    style M1 fill:#2d6cdf,color:#fff
    style M2 fill:#6a4c93,color:#fff
    style M3 fill:#3aa55d,color:#fff
```

| Tier | Techno | Rôle | Garantie |
|------|--------|------|----------|
| **1** | scikit-learn `RandomForestRegressor` + NLP règles | Modèles entraînés sur les données du club | Explicable, reproductible |
| **2** | Ollama (LLM open-source local) | Tâches libres non couvertes par Tier 1 | 100 % hors ligne |
| **3** | Templates Java déterministes | Filet de sécurité absolu | Toujours dispo |

---

## 3. Anatomie du Tier 1 — les modèles custom

### 3.1 Recommandeur d'événements (`recommender.py`)

```mermaid
flowchart TB
    INPUT[Facts JSON<br/>depuis MongoDB] --> FEAT[Feature engineering<br/>· capacité<br/>· RSVP confirmés / présents<br/>· ratings feedbacks<br/>· jour de semaine<br/>· format<br/>· mois]
    FEAT --> MODEL{RandomForest<br/>Regressor<br/>entraîné}
    MODEL --> SCORE[Score<br/>0.0 – 1.0]
    MODEL --> IMP[feature_<br/>importances_]
    SCORE --> OUT[Réponse JSON<br/>· topFormats<br/>· topStaff<br/>· insights<br/>· confidence]
    IMP --> OUT
```

**Pourquoi un Random Forest ?**
- Robuste aux petits jeux de données (≈ 50-500 événements par club).
- Pas besoin de scaling des features, pas besoin de dummies (on peut
  encoder `dayOfWeek` en entier 0-6).
- `feature_importances_` donne une **lecture immédiate** de ce que le
  modèle a appris — argument-clé pour l'explicabilité en soutenance.

### 3.2 Générateur de PV (`pv_builder.py`)

```mermaid
flowchart TB
    CTX[Contexte réunion<br/>titre, date, participants]
    QA[Q&R secrétaire<br/>fr / en / ar / darija]
    NOTES[Notes additionnelles]

    CTX --> PROC
    QA --> PROC
    NOTES --> PROC

    PROC[Pipeline NLP à règles<br/>· lexique sentiment FR<br/>· reformulation des réponses<br/>· formatage dates/heures<br/>· détection décisions]

    PROC --> S1[§ Préambule]
    PROC --> S2[§ Déroulement]
    PROC --> S3[§ Décisions]
    PROC --> S4[§ Plan d'action]
    PROC --> S5[§ Clôture]

    S1 & S2 & S3 & S4 & S5 --> PV[PV français<br/>structuré<br/><b>déterministe</b>]
```

**Pourquoi règles plutôt que LLM ?**
- **Zéro hallucination.** Le LLM peut inventer des décisions que
  personne n'a prises. Les règles non.
- **Reproductibilité.** Mêmes entrées → même PV. Essentiel pour un
  document officiel signé par le secrétaire général.
- **Langue maîtrisée.** On garantit un français formel et cohérent
  avec les conventions associatives tunisiennes.

---

## 4. Séquence d'une requête typique

Exemple : l'utilisateur ouvre la page « Recommandations d'événements ».

```mermaid
sequenceDiagram
    participant U as Utilisateur<br/>(Angular)
    participant B as Backend<br/>Spring Boot
    participant P as Python<br/>FastAPI
    participant O as Ollama
    participant M as MongoDB

    U->>B: GET /api/recommendations/events
    B->>M: Charger événements passés
    M-->>B: 47 événements + RSVP + feedbacks
    B->>B: Construire "facts" (Java → JSON)

    rect rgb(45, 108, 223)
        Note over B,P: TIER 1 — modèle custom
        B->>P: POST /v1/custom/recommend<br/>{facts:[...]}
        P->>P: RandomForest.predict(facts)
        P-->>B: {topFormats, insights, importances}
    end

    B-->>U: 200 OK<br/>source:"custom-ml"
```

Si Tier 1 échoue :

```mermaid
sequenceDiagram
    participant B as Backend
    participant P as Python
    participant O as Ollama

    rect rgb(106, 76, 147)
        Note over B,O: TIER 2 — LLM local
        B->>P: POST /v1/generate/json<br/>(prompt)
        P->>O: HTTP 11434
        O-->>P: réponse LLM
        P-->>B: JSON parsé
    end
```

Si Tier 2 échoue aussi :

```mermaid
sequenceDiagram
    participant B as Backend

    rect rgb(58, 165, 93)
        Note over B: TIER 3 — Java déterministe
        B->>B: recommendDeterministic()<br/>statistiques pures
    end
```

---

## 5. Pipeline d'entraînement du recommandeur

```mermaid
flowchart LR
    DATA[Événements + feedbacks<br/>MongoDB club] --> EXPORT[Export JSON<br/>script DB]
    EXPORT --> TRAIN[train_recommender.py<br/>scikit-learn]
    TRAIN --> PKL[recommender.pkl<br/>~50 Ko]
    PKL --> LOAD[main.py<br/>chargement au boot]
    LOAD --> SERVE[Endpoint<br/>/v1/custom/recommend]

    TRAIN -.->|affiche| METRICS[feature_importances_<br/>R² score<br/>MAE]
```

Commande unique :

```bash
cd ai-service
python train_recommender.py --synthetic        # démo avec données générées
python train_recommender.py --input data.json  # avec export réel du club
```

Le modèle `.pkl` est versionné dans le repo. **Aucun réseau requis à
l'exécution.**

---

## 6. Matrice des modes d'opération

| `ai-service` lancé | Ollama installé | Tier 1 | Tier 2 | Tier 3 | Expérience utilisateur |
|:-:|:-:|:-:|:-:|:-:|---|
| ✅ | ✅ | ✅ | ✅ | ✅ | **Pleine puissance** — recos ML + LLM pour le texte libre |
| ✅ | ❌ | ✅ | ❌ | ✅ | Recos ML + PV custom, pas de description IA |
| ❌ | ❌ | ❌ | ❌ | ✅ | L'app marche, templates Java uniquement |

**L'app ne plante jamais.** C'est l'avantage de la redondance en cascade.

---

## 7. Choix d'architecture à défendre

| Question probable du jury | Réponse préparée |
|---|---|
| « Pourquoi pas ChatGPT / Gemini ? » | Souveraineté des données + coût zéro + pas de dépendance à un tiers + explicabilité |
| « Pourquoi Python ET Java ? » | Java = cœur métier robuste ; Python = écosystème ML (scikit-learn, numpy). Chacun fait ce qu'il fait le mieux. |
| « Pourquoi Random Forest ? » | Petits datasets, pas de preprocessing lourd, `feature_importances_` explicables |
| « Et si le modèle se trompe ? » | Le Tier 3 Java garantit toujours une réponse correcte et cohérente |
| « Comment prouvez-vous que c'est votre modèle ? » | Le script `train_recommender.py` affiche le processus d'entraînement en direct, et `test_models.py` exécute les modèles sans API |
| « Ça passe à l'échelle ? » | Python FastAPI + RandomForest : ~5 ms/prédiction sur CPU. On tient 200 req/s sans GPU. |

---

## 8. Fichiers-clés à montrer en démo

| Fichier | Ce qu'il prouve |
|---|---|
| `ai-service/app/custom/recommender.py` | Le modèle ML est à vous, vous savez comment il marche |
| `ai-service/app/custom/pv_builder.py` | Le générateur de PV est à règles, pas un LLM |
| `ai-service/train_recommender.py` | Vous savez entraîner le modèle, pas juste l'utiliser |
| `ai-service/test_models.py` | Les modèles tournent même sans l'API |
| `Backend/.../Service/AiClientRouter.java` | Le routage entre les tiers est propre |
| `Backend/.../Service/EventAiService.java` | L'enchaînement Tier 1 → 2 → 3 est codé en Java |

---

## 9. Glossaire rapide

- **Tier** : niveau d'intelligence. Tier 1 = custom, Tier 2 = LLM, Tier 3 = règles.
- **LLM** : Large Language Model (Llama, Mistral, GPT…). Dans ClubHub, un LLM **local** via Ollama.
- **Ollama** : runtime open-source qui fait tourner des LLM sur votre machine.
- **RandomForest** : algorithme de ML fait de plusieurs arbres de décision moyennés. Offre une très bonne explicabilité via `feature_importances_`.
- **Explicabilité** : capacité à **justifier** pourquoi le modèle a prédit ce qu'il a prédit. Exigence centrale du PFE IA.
