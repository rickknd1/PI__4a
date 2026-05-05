"""
Offline training CLI for the ClubHub custom recommender.

This script is optional — the service can also train on-the-fly from the
payload sent by the Backend at each request. It exists so the PFE defence
can show a reproducible, file-based artefact:

    python train_recommender.py events.json
        → app/custom/models/recommender.pkl

and demonstrate the model being reloaded at boot.

Input format (JSON array, one row per past event):
    [
      {
        "format": "workshop",
        "dayOfWeek": "SATURDAY",
        "startDate": "2025-11-08T14:00",
        "capacity": 40,
        "rsvpConfirmed": 33,
        "scannedAttendees": 31,
        "attendanceRate": 0.77,
        "staff": ["Rania Ben Amor (speaker)", "Ahmed K. (moderator)"],
        "feedbackComposite": 4.2
      },
      ...
    ]

If you don't have historical data yet, run with `--synth 25` to emit a
demo dataset, train on it, and see the pipeline end-to-end.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys
from datetime import datetime, timedelta
from pathlib import Path

import joblib

# Windows console defaults to cp1252, which cannot encode "→" / "✓".
# Re-open stdout/stderr as UTF-8 so the nice terminal formatting below
# renders correctly in PowerShell without crashing.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# Allow running `python train_recommender.py` from the repo root OR from
# inside ai-service/ — append the service folder to sys.path if needed.
HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

from app.custom import recommender  # noqa: E402


DEFAULT_OUTPUT = HERE / "app" / "custom" / "models" / "recommender.pkl"


# ── Synthetic dataset for demos ─────────────────────────────────────────


def _synth_dataset(n: int = 25) -> list[dict]:
    """Produces a plausible fake history so training can be showcased
    without any real DB data. The true attendance rate is a hidden linear
    function of (format, dayOfWeek, hour) + Gaussian noise, so the trained
    model should recover the ordering consistent with the demo."""
    random.seed(42)
    formats = ["workshop", "conference", "training", "competition",
               "networking", "trip_outing"]
    days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY",
            "FRIDAY", "SATURDAY", "SUNDAY"]
    staff_pool = [
        ("Rania Ben Amor", "speaker"),
        ("Ahmed K.", "moderator"),
        ("Mariem Sfar", "organizer"),
        ("Youssef B.", "technician"),
        ("Salma Jouini", "organizer"),
    ]

    base_rate = {
        "workshop": 0.72, "conference": 0.55, "training": 0.65,
        "competition": 0.80, "networking": 0.50, "trip_outing": 0.45,
    }
    day_boost = {"SATURDAY": 0.08, "FRIDAY": 0.04, "SUNDAY": 0.00,
                 "THURSDAY": 0.02, "WEDNESDAY": -0.02,
                 "TUESDAY": -0.04, "MONDAY": -0.05}

    rows = []
    start = datetime(2025, 1, 10, 18, 0)
    for i in range(n):
        fmt = random.choice(formats)
        dow = random.choice(days)
        hour = random.choice([10, 14, 16, 18, 19, 20])
        capacity = random.choice([30, 50, 80, 120])
        rate = max(0.1, min(1.0,
            base_rate[fmt] + day_boost[dow] + (hour - 17) * 0.01
            + random.gauss(0, 0.08)
        ))
        rsvp = int(rate * capacity * random.uniform(0.9, 1.05))
        scanned = int(rsvp * random.uniform(0.85, 1.0))
        staff = [f"{n} ({r})" for n, r in random.sample(staff_pool, k=random.randint(1, 3))]
        feedback = round(min(5.0, max(1.0, rate * 4 + 1 + random.gauss(0, 0.4))), 1)

        start_date = (start + timedelta(days=i * 9)).replace(hour=hour)
        rows.append({
            "title": f"Demo event #{i+1}",
            "format": fmt,
            "dayOfWeek": dow,
            "startDate": start_date.isoformat(timespec="minutes"),
            "capacity": capacity,
            "rsvpConfirmed": rsvp,
            "scannedAttendees": scanned,
            "attendanceRate": round(scanned / capacity, 2),
            "staff": staff,
            "feedbackComposite": feedback,
        })
    return rows


# ── CLI ─────────────────────────────────────────────────────────────────


def main() -> int:
    parser = argparse.ArgumentParser(description="Train the ClubHub custom recommender.")
    parser.add_argument("dataset", nargs="?", help="Path to the events JSON (array). Omit to use --synth.")
    parser.add_argument("--synth", type=int, default=0,
                        help="Generate a synthetic dataset of N events and train on it.")
    parser.add_argument("-o", "--output", default=str(DEFAULT_OUTPUT),
                        help="Where to save the trained pickle.")
    args = parser.parse_args()

    if args.synth > 0:
        facts = _synth_dataset(args.synth)
        print(f"→ Using a synthetic dataset of {args.synth} events.")
    elif args.dataset:
        with open(args.dataset, "r", encoding="utf-8") as fp:
            facts = json.load(fp)
        print(f"→ Loaded {len(facts)} events from {args.dataset}.")
    else:
        parser.print_help()
        return 2

    model = recommender.train(facts)
    if model is None:
        print("✗ Training skipped — need at least 4 usable events "
              "and scikit-learn installed.")
        return 1

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, out)
    print(f"✓ Trained on {len(facts)} events.")
    print(f"✓ Saved to {out.resolve()}  ({out.stat().st_size // 1024} KB)")

    # Show feature importances — the headline explainability story.
    print("\nFeature importances (how much each signal drives the prediction):")
    for name, imp in sorted(
        zip(model.feature_names, model.model.feature_importances_),
        key=lambda t: t[1], reverse=True,
    ):
        bar = "█" * int(imp * 40)
        print(f"  {name:22s} {imp:5.2%}  {bar}")

    # Quick smoke test: reload and run a single inference.
    print("\nSmoke test — reloading and predicting a Saturday 18h workshop of capacity 50:")
    reloaded = joblib.load(out)
    pred = reloaded.predict(
        format_="workshop", day="SATURDAY", hour=18,
        capacity=50, staff_size=2, feedback=4.0,
    )
    print(f"  predicted attendance rate = {pred:.1%}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
