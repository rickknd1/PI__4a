import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

import base64
import os
import subprocess
import tempfile
from pathlib import Path

import torch
from faster_whisper import WhisperModel
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification

try:
    from better_profanity import profanity as bp
    bp.load_censor_words()
    _bp_available = True
except ImportError:
    _bp_available = False

app = FastAPI(title="Audio Moderation Service")

BASE = Path(__file__).parent.parent / "Ai"
WHISPER_DIR = BASE / "Whisper-tn-ct2"
XLM_DIR = BASE / "XlmRoberta"

# Must match config.json id2label: 0=CLEAN, 1=HARASSMENT, 2=PROFANITY
LABELS = ["CLEAN", "HARASSMENT", "PROFANITY"]
CONFIDENCE_THRESHOLD = 0.75
SUPPORTED_LANGUAGES = {"en", "fr", "ar"}

print(f"[Init] Loading Whisper from {WHISPER_DIR}...")
whisper_model = WhisperModel(str(WHISPER_DIR), device="cpu", compute_type="int8")
print("[Init] Whisper loaded.")

print(f"[Init] Loading XLM-Roberta from {XLM_DIR}...")
xlm_tokenizer = AutoTokenizer.from_pretrained(str(XLM_DIR))
xlm_classifier = AutoModelForSequenceClassification.from_pretrained(str(XLM_DIR))
xlm_classifier.eval()
print("[Init] XLM-Roberta loaded.")


class AnalyzeRequest(BaseModel):
    audioData: str
    contentType: str = "audio/webm"


class AnalyzeResponse(BaseModel):
    label: str
    confidence: float
    transcript: str
    scores: dict[str, float]
    flagged: bool


def transcribe(audio_bytes: bytes, content_type: str) -> str:
    ext = ".webm"
    if "ogg" in content_type:
        ext = ".ogg"
    elif "mp4" in content_type or "m4a" in content_type:
        ext = ".mp4"
    elif "wav" in content_type:
        ext = ".wav"
    elif "mp3" in content_type:
        ext = ".mp3"

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    wav_path = tmp_path + "_clean.wav"
    try:
        subprocess.run(
            [
                "ffmpeg", "-i", tmp_path,
                "-ar", "16000", "-ac", "1",
                "-af", "highpass=f=80,lowpass=f=8000,loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=2",
                wav_path, "-y", "-loglevel", "quiet",
            ],
            check=True,
        )

        segments_gen, info = whisper_model.transcribe(
            wav_path,
            beam_size=5,
            best_of=5,
            temperature=[0.0, 0.2, 0.4],
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300, "speech_pad_ms": 200},
            condition_on_previous_text=False,
            word_timestamps=False,
            no_speech_threshold=0.5,
            compression_ratio_threshold=2.0,
        )

        print(f"[Whisper] Detected language: '{info.language}' ({info.language_probability:.0%})")

        if info.language not in SUPPORTED_LANGUAGES:
            print(f"[Whisper] Skipping — '{info.language}' not in supported set")
            return ""

        transcript = " ".join(seg.text for seg in segments_gen).strip()
        print(f"[Whisper] Transcript: '{transcript}'")
        return transcript
    finally:
        os.unlink(tmp_path)
        if os.path.exists(wav_path):
            os.unlink(wav_path)


def classify(text: str) -> tuple[str, float, dict[str, float]]:
    if not text.strip():
        return "CLEAN", 1.0, {lbl: (1.0 if lbl == "CLEAN" else 0.0) for lbl in LABELS}

    inputs = xlm_tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        logits = xlm_classifier(**inputs).logits
    probs = torch.softmax(logits, dim=-1).squeeze().tolist()

    scores = {LABELS[i]: round(float(probs[i]), 4) for i in range(len(LABELS))}
    best_idx = int(torch.argmax(logits).item())
    return LABELS[best_idx], float(probs[best_idx]), scores


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    audio_bytes = base64.b64decode(req.audioData)
    transcript = transcribe(audio_bytes, req.contentType)
    label, confidence, scores = classify(transcript)

    flagged = label != "CLEAN" and confidence >= CONFIDENCE_THRESHOLD

    # English profanity rule-based fallback for short/missed segments
    if not flagged and _bp_available and transcript and bp.contains_profanity(transcript):
        print(f"[Profanity Filter] Rule-based hit: '{transcript}'")
        label = "PROFANITY"
        confidence = max(confidence, 0.90)
        flagged = True

    return AnalyzeResponse(
        label=label,
        confidence=round(confidence, 4),
        transcript=transcript,
        scores=scores,
        flagged=flagged,
    )


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/test-classify")
def test_classify(text: str):
    label, confidence, scores = classify(text)
    flagged = label != "CLEAN" and confidence >= CONFIDENCE_THRESHOLD
    return {"text": text, "label": label, "confidence": confidence, "scores": scores, "flagged": flagged}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
