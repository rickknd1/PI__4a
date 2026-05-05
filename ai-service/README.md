# ClubHub AI Service (Python, local, no Docker)

A FastAPI service that hosts **ClubHub's own AI models** (trained on the club's
own data) and acts as a bridge to a local LLM (Ollama) as an optional fallback.

```
Frontend ─► Gateway ─► Backend (Java) ─► localhost:8000 (this service)
                                          ├─► Custom models (scikit-learn + rules)
                                          │     ├─ /v1/custom/recommend  (RandomForest)
                                          │     └─ /v1/custom/pv         (rule-based NLP)
                                          │
                                          └─► Ollama bridge (optional LLM tier)
                                                ├─ /v1/generate/text
                                                └─ /v1/generate/json
```

## 0. Three AI tiers — at a glance

| Tier | What | Where | When it wins |
| ---- | ---- | ----- | ------------ |
| **Tier 1 — Custom models (ours)** | `RandomForestRegressor` recommender + rule-based French PV generator | `app/custom/` in this folder | Always first choice. Trained on YOUR club's past events. No internet, no hallucination. |
| Tier 2 — LLM fallback | Ollama (or Google Gemini) | Java `AiClientRouter` | Only for features the custom models don't cover (e.g. free-form event-description drafting). |
| Tier 3 — Deterministic templates | Pure Java code | `PvAiService.fallbackTemplate`, `EventRecommendationController.recommendDeterministic` | When everything above is down. Guarantees the UI never breaks. |

Tier 1 is the star of the show: **it's a small ML model you train and own** —
much stronger story for a PFE defence than "we use an external LLM API".

## 1. Prerequisites

Install these **natively on Windows** — no Docker required.

1. **Python 3.10 or newer** → https://www.python.org/downloads/
   Check the *"Add python.exe to PATH"* box during install.
2. *(Optional, only for Tier 2)* **Ollama** → https://ollama.com/download
   After install, Ollama runs as a background service on `localhost:11434`.
   ```powershell
   ollama pull llama3.2:3b
   ```

## 2. Start the service

From this `ai-service/` folder:

```powershell
.\run.ps1
```

That script creates a `.venv`, installs deps on first run (including scikit-learn
and numpy), copies `.env.example → .env`, and starts FastAPI on
`http://localhost:8000`.

Check everything is wired:

- Browse **http://localhost:8000/docs** — interactive Swagger UI
- Browse **http://localhost:8000/health**:

  ```json
  {
    "status": "ok",
    "provider": "ollama",
    "upstream_reachable": true,
    "model": "llama3.2:3b",
    "custom_models_enabled": true,
    "custom_recommender_loaded": false
  }
  ```

  `custom_models_enabled: true` means Tier 1 is live. `custom_recommender_loaded`
  flips to `true` once you train an offline pickle (see §5 below). Otherwise the
  recommender retrains per request from whatever facts the Backend sends.

## 3. Wire the Java Backend

`Backend/src/main/resources/application.properties` is **already set up** — nothing
to change. The relevant block reads:

```properties
ai.provider=${AI_PROVIDER:auto}
ai.local.base-url=${AI_LOCAL_BASE_URL:http://localhost:8000}
ai.local.timeout-ms=120000
ai.local.fallback-to-gemini=true
```

As soon as Python is up, the Backend:

- Sends **event-recommendation** requests to `/v1/custom/recommend` (Tier 1).
  The Angular widget shows `source: "custom-ml"`, with `model:
  "RandomForestRegressor (scikit-learn)"`.
- Sends **PV-generation** requests to `/v1/custom/pv` (Tier 1). The returned
  French text goes straight into the editable preview.
- Falls through to Tier 2 (Ollama / Gemini) only when the custom models are
  disabled or return null.

Force a specific tier from the frontend by adding `?source=custom` /
`?source=llm` / `?source=stats` to `/api/recommendations/events`.

## 4. Endpoints

| Method | Path                       | Tier | Purpose                                              |
| ------ | -------------------------- | ---- | ---------------------------------------------------- |
| GET    | `/health`                  | —    | Liveness + tier status (custom_models_enabled, …)    |
| POST   | **`/v1/custom/recommend`** | 1    | RandomForest recommender — typed JSON in / out       |
| POST   | **`/v1/custom/pv`**        | 1    | Rule-based French PV builder — typed JSON in / text out |
| POST   | `/v1/generate/text`        | 2    | LLM plain-text completion                            |
| POST   | `/v1/generate/json`        | 2    | LLM JSON-constrained completion                      |

### Example — `POST /v1/custom/recommend`

Request (Java sends the same "facts" it would otherwise embed in an LLM prompt):

```json
{
  "facts": [
    {
      "title": "React workshop",
      "format": "workshop",
      "dayOfWeek": "SATURDAY",
      "startDate": "2025-11-08T14:00",
      "capacity": 40,
      "rsvpConfirmed": 33,
      "scannedAttendees": 31,
      "attendanceRate": 0.77,
      "staff": ["Rania Ben Amor (speaker)"],
      "feedbackComposite": 4.2
    },
    { "...": "more past events" }
  ]
}
```

Response (same shape the Angular widget already consumes):

```json
{
  "totalPastEvents": 12,
  "topFormats": [
    {
      "format": "workshop", "totalEvents": 5, "score": 78.4,
      "avgAttendanceRate": 0.76, "avgFeedback": 4.1,
      "confidence": "high",
      "rationale": "5 événement(s), présence moyenne 76%, feedback 4.1/5 ; modèle prédit 79%."
    }
  ],
  "topStaff": [ /* … */ ],
  "topTiming": [ /* day × slot ranking */ ],
  "suggestedFormat": "workshop",
  "suggestedStaff": [{ "name": "Rania Ben Amor", "role": "speaker" }],
  "suggestedTiming": {
    "dayOfWeek": "Saturday", "timeOfDay": "afternoon",
    "typicalHour": 14, "suggestedDate": "2026-05-02T14:00",
    "score": 82.0, "confidence": "high",
    "rationale": "Sur les événements du saturday passés, le taux de présence moyen est de 76%…"
  },
  "insights": [
    "Le modèle RandomForest identifie le format comme le facteur le plus explicatif (importance 42%)…",
    "…"
  ],
  "nextActions": ["Programmer le prochain événement en format « workshop » — score 78.4/100", "…"],
  "caveats": [],
  "source": "custom-ml",
  "model": "RandomForestRegressor (scikit-learn)"
}
```

### Example — `POST /v1/custom/pv`

Request:

```json
{
  "context": { "title": "Atelier React", "startDate": "2025-11-08T14:00",
               "location": {"name": "Salle B-201"}, "attendance": {"confirmed": 33, "checkedIn": 31, "attendanceRatePct": 77}, "…": "…" },
  "qaPairs": [
    { "section": "déroulement", "type": "yesno",
      "question": "Le programme a-t-il été respecté ?", "answer": "OUI" }
  ],
  "additionalNotes": ""
}
```

Response:

```json
{
  "text": "=== PRÉAMBULE ===\nLe présent procès-verbal documente…",
  "model": "rule-based-nlp (fr)",
  "source": "custom"
}
```

## 5. Train an offline model (optional but great for the PFE demo)

The recommender **trains in-memory at every request by default** (fast: under
100 ms for hundreds of events). But you can also train it once offline and
ship a reusable pickle — makes for a clean demo story ("here's my trained
model artefact, now the service reloads it at boot").

From this folder, with the venv activated:

```powershell
# Option A — use a real export of your events as JSON
python train_recommender.py events.json

# Option B — generate a synthetic 25-event demo dataset and train on it
python train_recommender.py --synth 25
```

Output:

```
→ Using a synthetic dataset of 25 events.
✓ Trained on 25 events.
✓ Saved to C:\…\ai-service\app\custom\models\recommender.pkl  (178 KB)

Feature importances (how much each signal drives the prediction):
  format                 42.11%  ████████████████
  dayOfWeek              21.04%  ████████
  hour                   16.50%  ██████
  capacity                9.22%  ███
  feedbackComposite       7.40%  ██
  staffSize               3.73%  █
```

On the next service start, `/health` will show `custom_recommender_loaded: true`
and every `/v1/custom/recommend` call will reuse the loaded model. Retrain
periodically (weekly / monthly) by re-running the script.

## 6. Swap the Ollama model (Tier 2 only)

Edit `.env`:

```env
OLLAMA_MODEL=mistral:7b-instruct-q4_K_M
```

Then restart the service. No Java change needed.

## 7. Troubleshooting

| Symptom                                          | Fix                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| UI shows `source: "stats-fallback"` even when Python is up | Check `/v1/custom/recommend` logs — usually means your DB has zero past events. Import some or seed a few. |
| `/health` → `custom_models_enabled: false`        | Set `CUSTOM_MODELS_ENABLED=true` in `.env` and restart.                                 |
| `Recommender failed: …`                          | Look at the ai-service console — Python exception is printed. Most common: facts list missing required fields. |
| Tier 2 `/health` → `upstream_reachable: false`    | Ollama not running. Launch it from Start menu or `ollama serve`. Tier 1 still works.    |
| Model always answers in English (Tier 2)          | Put `"Réponds en français."` at the top of the prompt (PvAiService already does this).  |
| Very slow generation (> 60s, Tier 2)              | Use a smaller model: `ollama pull llama3.2:1b` then set `OLLAMA_MODEL=llama3.2:1b`.     |

## 8. Files

```
ai-service/
├── app/
│   ├── __init__.py
│   ├── config.py                    # reads .env
│   ├── main.py                      # FastAPI app + /v1/* routes
│   ├── router.py                    # picks the active LLM provider (Tier 2)
│   ├── custom/                      # ← Tier 1 — YOUR models
│   │   ├── __init__.py
│   │   ├── recommender.py           # RandomForest event recommender
│   │   ├── pv_builder.py            # rule-based French PV generator
│   │   └── models/                  # pickles land here after training
│   └── providers/                   # Tier 2 LLM adapters
│       ├── base.py                  # Provider interface
│       ├── ollama.py                # Ollama client
│       └── template.py              # no-LLM fallback
├── .env.example
├── requirements.txt
├── run.ps1                          # one-shot launcher
├── train_recommender.py             # offline CLI trainer + synthetic dataset
└── README.md
```

## 9. Why this architecture is good for a PFE defence

> « J'ai construit trois couches d'IA empilées en cascade de repli :
> un modèle `RandomForestRegressor` de `scikit-learn` entraîné sur les
> données historiques du club pour la recommandation d'événements, un
> pipeline NLP déterministe à base de règles et de lexiques de
> sentiment pour la génération de procès-verbaux en français, et un
> LLM local (Ollama) en couche de secours pour les fonctionnalités
> plus ouvertes. Chaque couche est observable, reproductible et
> reproductible offline. Le modèle ML est explicable via les
> `feature_importances_` exposées à l'utilisateur final. »

That's a much stronger pitch than "we call the Gemini API".
