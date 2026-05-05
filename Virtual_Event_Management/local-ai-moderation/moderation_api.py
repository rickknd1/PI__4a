from fastapi import FastAPI
from pydantic import BaseModel
from detoxify import Detoxify
import re
import unicodedata

app = FastAPI()

model = Detoxify("multilingual")

class ModerationRequest(BaseModel):
    text: str

def normalize_tunisian(text: str) -> str:
    text = text.lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")

    replacements = {
        "9": "q",
        "7": "h",
        "3": "a",
        "5": "kh",
        "2": "a",
        "8": "gh",
        "@": "a",
        "$": "s"
    }

    for k, v in replacements.items():
        text = text.replace(k, v)

    text = re.sub(r"[^a-zA-Z0-9\u0600-\u06FF\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    return text

@app.post("/moderate")
def moderate(request: ModerationRequest):
    original_text = request.text
    normalized_text = normalize_tunisian(original_text)

    result_original = model.predict(original_text)
    result_normalized = model.predict(normalized_text)

    scores = {
        "toxicity": max(float(result_original.get("toxicity", 0)), float(result_normalized.get("toxicity", 0))),
        "severe_toxicity": max(float(result_original.get("severe_toxicity", 0)), float(result_normalized.get("severe_toxicity", 0))),
        "obscene": max(float(result_original.get("obscene", 0)), float(result_normalized.get("obscene", 0))),
        "threat": max(float(result_original.get("threat", 0)), float(result_normalized.get("threat", 0))),
        "insult": max(float(result_original.get("insult", 0)), float(result_normalized.get("insult", 0))),
        "identity_attack": max(float(result_original.get("identity_attack", 0)), float(result_normalized.get("identity_attack", 0)))
    }

    max_score = max(scores.values())

    if max_score >= 0.65:
        return {
            "allowed": False,
            "flagged": True,
            "reason": f"Toxic content detected by local AI. Score={max_score}",
            "score": max_score
        }

    return {
        "allowed": True,
        "flagged": False,
        "reason": "Allowed",
        "score": max_score
    }