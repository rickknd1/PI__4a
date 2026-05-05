from flask import Flask, request, jsonify
from faster_whisper import WhisperModel
import tempfile
import os
import traceback

app = Flask(__name__)

print("⏳ Chargement du modèle Whisper medium...")
model = WhisperModel("medium", device="cpu", compute_type="int8")
print("✅ Modèle prêt !")

@app.route("/v1/audio/transcriptions", methods=["POST"])
def transcribe():
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier audio fourni"}), 400

    audio_file = request.files["file"]
    language   = request.form.get("language", None)

    # ✅ FIX : "auto" ou "" → None (détection automatique)
    if not language or language.strip() == "auto":
        language = None

    ext = os.path.splitext(audio_file.filename)[1] or ".mp3"

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name

    try:
        segments, info = model.transcribe(
            tmp_path,
            language=language,
            beam_size=5,
            vad_filter=True,
        )
        text = " ".join([seg.text for seg in segments])
        return jsonify({
            "text": text.strip(),
            "language": info.language,
            "language_probability": round(info.language_probability, 2)
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "whisper-medium"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9000, debug=False)