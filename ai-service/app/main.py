"""FastAPI entry point.

Two families of endpoints:

    LLM fallback (Gemini-compatible minimal surface):
        POST /v1/generate/text  -> { "text": "..." }
        POST /v1/generate/json  -> { "data": <any JSON> }

    Custom in-house ML models (scikit-learn + rule-based NLP):
        POST /v1/custom/recommend -> event recommendations (RandomForest)
        POST /v1/custom/pv        -> procès-verbal (rule-based NLP)
        POST /v1/custom/sentiment -> feedback comment sentiment (LogReg + TF-IDF)

The Java Backend normally hits the /v1/custom/* endpoints first and only
falls back to /v1/generate/* when the custom models are disabled or the
feature isn't covered (e.g. free-form event-description drafting).
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .config import get_settings
from .custom import pv_builder, recommender
from .providers.base import ProviderError
from .router import get_provider

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s :: %(message)s",
)
log = logging.getLogger("ai-service")

app = FastAPI(
    title="ClubHub AI Service",
    version="2.0.0",
    description=(
        "Local AI bridge — custom scikit-learn models + optional LLM "
        "fallback via Ollama. No Docker, no external APIs."
    ),
)


# ── Pre-trained recommender loader ───────────────────────────────────────
#
# When CUSTOM_RECOMMENDER_MODEL_PATH points to an existing joblib pickle,
# we load it once at boot so every request reuses the same model instead
# of re-fitting. Otherwise we pass None to the recommender and let it
# train on-the-fly from the caller-provided facts.

@lru_cache(maxsize=1)
def _preloaded_recommender() -> recommender.Recommender | None:
    settings = get_settings()
    path = settings.custom_recommender_model_path
    if not path or not os.path.exists(path):
        return None
    try:
        import joblib
        rec = joblib.load(path)
        log.info("Loaded pre-trained recommender from %s", path)
        return rec
    except Exception as exc:
        log.warning("Could not load pre-trained recommender (%s): %s", path, exc)
        return None


# ── Schemas ──────────────────────────────────────────────────────────────


class TextRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    temperature: float = Field(0.4, ge=0.0, le=1.5)


class JsonRequest(BaseModel):
    prompt: str = Field(..., min_length=1)
    schema_hint: dict[str, Any] | None = None
    temperature: float = Field(0.3, ge=0.0, le=1.5)


class TextResponse(BaseModel):
    text: str
    provider: str
    model: str | None = None


class JsonResponse(BaseModel):
    data: Any
    provider: str
    model: str | None = None


class HealthResponse(BaseModel):
    status: str
    provider: str
    upstream_reachable: bool
    model: str | None = None
    custom_models_enabled: bool
    custom_recommender_loaded: bool


class RecommendRequest(BaseModel):
    """Matches the list of `eventFacts` built by Java's EventAiService."""
    facts: list[dict[str, Any]] = Field(default_factory=list)


class PvRequest(BaseModel):
    """Matches `EventContextService.buildContext` + the secretary's answers."""
    context: dict[str, Any]
    qaPairs: list[dict[str, Any]] = Field(default_factory=list)
    additionalNotes: str | None = None


class SentimentRequest(BaseModel):
    """Free-text comments to classify. Empty / whitespace strings are skipped."""
    comments: list[str] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    audioData: str = ""
    contentType: str | None = "audio/webm"


class AnalyzeResponse(BaseModel):
    label: str
    confidence: float
    transcript: str
    scores: dict[str, float]
    flagged: bool


# ── Routes ───────────────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    settings = get_settings()
    provider = get_provider()
    reachable = provider.is_available()
    return HealthResponse(
        status="ok",
        provider=provider.name,
        upstream_reachable=reachable,
        model=settings.ollama_model if provider.name == "ollama" else None,
        custom_models_enabled=settings.custom_models_enabled,
        custom_recommender_loaded=_preloaded_recommender() is not None,
    )


@app.post("/v1/generate/text", response_model=TextResponse)
def generate_text(req: TextRequest) -> TextResponse:
    provider = get_provider()
    settings = get_settings()
    try:
        text = provider.generate_text(req.prompt, temperature=req.temperature)
    except ProviderError as exc:
        log.warning("Text generation failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))
    return TextResponse(
        text=text,
        provider=provider.name,
        model=settings.ollama_model if provider.name == "ollama" else None,
    )


@app.post("/v1/generate/json", response_model=JsonResponse)
def generate_json(req: JsonRequest) -> JsonResponse:
    provider = get_provider()
    settings = get_settings()
    try:
        data = provider.generate_json(
            req.prompt, schema_hint=req.schema_hint, temperature=req.temperature
        )
    except ProviderError as exc:
        log.warning("JSON generation failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))
    return JsonResponse(
        data=data,
        provider=provider.name,
        model=settings.ollama_model if provider.name == "ollama" else None,
    )


# ── Custom models ────────────────────────────────────────────────────────


@app.post("/v1/custom/recommend")
def custom_recommend(req: RecommendRequest) -> dict[str, Any]:
    """Runs the in-house RandomForest-backed recommender.

    The caller hands us the same `facts` list it would otherwise embed in
    an LLM prompt. We produce the full UI payload (topFormats, topStaff,
    suggestedTiming, insights, nextActions, caveats, …) so no frontend
    change is required.
    """
    settings = get_settings()
    if not settings.custom_models_enabled:
        raise HTTPException(status_code=503, detail="Custom models are disabled (CUSTOM_MODELS_ENABLED=false).")
    try:
        result = recommender.recommend(req.facts, pretrained=_preloaded_recommender())
        return result
    except Exception as exc:
        log.exception("Custom recommender failed")
        raise HTTPException(status_code=500, detail=f"Recommender failed: {exc}")


@app.post("/v1/custom/pv")
def custom_pv(req: PvRequest) -> dict[str, Any]:
    """Builds a French PV from the structured event context + Q&A answers."""
    settings = get_settings()
    if not settings.custom_models_enabled:
        raise HTTPException(status_code=503, detail="Custom models are disabled.")
    try:
        text = pv_builder.build_pv(req.context, req.qaPairs, req.additionalNotes)
        return {
            "text": text,
            "model": "rule-based-nlp (fr)",
            "source": "custom",
        }
    except Exception as exc:
        log.exception("Custom PV builder failed")
        raise HTTPException(status_code=500, detail=f"PV builder failed: {exc}")


@app.post("/v1/custom/sentiment")
def custom_sentiment(req: SentimentRequest) -> dict[str, Any]:
    """Scores free-text feedback comments with the in-house Logistic
    Regression classifier (TF-IDF + bi-grams, FR/EN bootstrap dataset).

    Empty or whitespace-only entries are dropped before scoring so the
    aggregates reflect only actual opinions.

    Response shape:
        {
          "count": <total non-empty comments scored>,
          "positive": <int>, "neutral": <int>, "negative": <int>,
          "percentPositive": <float>, "percentNeutral": <float>, "percentNegative": <float>,
          "items": [
              {"text": "...", "label": "positive|neutral|negative", "confidence": 0.91},
              ...
          ],
          "model": "logreg-tfidf-bigrams",
          "source": "custom"
        }

    Returns 503 if the trained .pkl is missing — callers should fall back.
    """
    settings = get_settings()
    if not settings.custom_models_enabled:
        raise HTTPException(status_code=503, detail="Custom models are disabled.")

    if pv_builder.SENTIMENT_MODEL is None:
        raise HTTPException(
            status_code=503,
            detail="Sentiment model not loaded. Run train_sentiment.py first.",
        )

    cleaned = [(idx, c) for idx, c in enumerate(req.comments or []) if c and c.strip()]
    if not cleaned:
        return {
            "count": 0,
            "positive": 0, "neutral": 0, "negative": 0,
            "percentPositive": 0.0, "percentNeutral": 0.0, "percentNegative": 0.0,
            "items": [],
            "model": "logreg-tfidf-bigrams",
            "source": "custom",
        }

    texts = [c for _, c in cleaned]
    label_map = {0: "negative", 1: "neutral", 2: "positive"}
    try:
        preds = pv_builder.SENTIMENT_MODEL.predict(texts)
        # predict_proba returns columns aligned to model.classes_
        probas = pv_builder.SENTIMENT_MODEL.predict_proba(texts)
        classes = list(pv_builder.SENTIMENT_MODEL.classes_)
    except Exception as exc:
        log.exception("Sentiment scoring failed")
        raise HTTPException(status_code=500, detail=f"Sentiment failed: {exc}")

    items: list[dict[str, Any]] = []
    pos = neu = neg = 0
    for (orig_idx, text), pred, proba in zip(cleaned, preds, probas):
        label = label_map.get(int(pred), "neutral")
        confidence = float(proba[classes.index(int(pred))]) if int(pred) in classes else 0.0
        items.append({
            "index": orig_idx,
            "text": text,
            "label": label,
            "confidence": round(confidence, 3),
        })
        if label == "positive":
            pos += 1
        elif label == "negative":
            neg += 1
        else:
            neu += 1

    total = pos + neu + neg
    return {
        "count": total,
        "positive": pos, "neutral": neu, "negative": neg,
        "percentPositive": round(100.0 * pos / total, 1) if total else 0.0,
        "percentNeutral":  round(100.0 * neu / total, 1) if total else 0.0,
        "percentNegative": round(100.0 * neg / total, 1) if total else 0.0,
        "items": items,
        "model": "logreg-tfidf-bigrams",
        "source": "custom",
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze_audio(req: AnalyzeRequest) -> AnalyzeResponse:
    """Compatibility endpoint used by InstantVoiceManagment backend.

    The current AI service does not include speech-to-text/toxicity models yet.
    We return a safe moderation payload so the backend flow remains functional
    (no 404/500) and can be upgraded later without changing backend contracts.
    """
    has_audio = bool((req.audioData or "").strip())
    if not has_audio:
        return AnalyzeResponse(
            label="OTHER",
            confidence=0.0,
            transcript="",
            scores={"safe": 1.0, "toxicity": 0.0},
            flagged=False,
        )

    # Conservative default: do not auto-flag until a real classifier is plugged in.
    return AnalyzeResponse(
        label="OTHER",
        confidence=0.51,
        transcript="(transcript unavailable in current local AI build)",
        scores={"safe": 0.51, "toxicity": 0.49},
        flagged=False,
    )
