"""
Custom scikit-learn recommender for ClubHub events.

Why build our own model instead of calling an LLM?
    * The input space is small and well-typed (format × day × hour × staff
      × capacity → attendance_rate). A RandomForestRegressor handles this
      in milliseconds and is 100% explainable via feature_importances_.
    * The dataset is tiny (dozens of past events per club), so there is
      nothing to gain from a 3-billion-parameter language model — a tree
      ensemble converges on a few samples and never hallucinates.
    * The artefact is a ~200 KB `.pkl` that belongs to the club; no API
      key, no vendor lock-in, reproducible for the thesis defence.

The public entry point is `recommend(facts, pretrained=None)`. It returns
the exact JSON shape the Angular widget expects (topFormats, topStaff,
suggestedTiming, insights, nextActions, caveats, …) so the frontend
doesn't need a single line of change.

Training happens on-the-fly from the caller-provided `facts` list, so the
model always reflects the latest DB state. A companion CLI can also fit
offline on an exported dataset and dump a reusable pickle.
"""

from __future__ import annotations

import logging
import math
import os
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Sequence

import numpy as np

try:
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.preprocessing import OrdinalEncoder

    _SKLEARN = True
except ImportError:  # pragma: no cover — dependency missing, fall back
    _SKLEARN = False


log = logging.getLogger(__name__)

# ── Reference tables ────────────────────────────────────────────────────

# English day names match Java's DayOfWeek.toString() + the frontend
# interface (SuggestedTiming.dayOfWeek: "Saturday" etc.).
DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY",
             "FRIDAY", "SATURDAY", "SUNDAY"]

# French day names for the human-readable rationales / insights.
DAY_FR = {
    "MONDAY": "lundi", "TUESDAY": "mardi", "WEDNESDAY": "mercredi",
    "THURSDAY": "jeudi", "FRIDAY": "vendredi",
    "SATURDAY": "samedi", "SUNDAY": "dimanche",
}

# Minimum sample size per bucket to claim each confidence level.
CONF_THRESHOLDS = [(5, "high"), (2, "medium"), (0, "low")]


@dataclass
class Recommender:
    """A thin wrapper around a RandomForestRegressor + its encoders.

    We keep this class so the offline training script can dump a single
    pickle containing everything inference needs.
    """

    model: Any  # RandomForestRegressor
    format_encoder: Any  # OrdinalEncoder
    day_encoder: Any  # OrdinalEncoder
    feature_names: list[str]

    def predict(self, format_: str, day: str, hour: int,
                capacity: int, staff_size: int, feedback: float | None) -> float:
        fmt_idx = _encode(self.format_encoder, format_)
        day_idx = _encode(self.day_encoder, day)
        fb = -1.0 if feedback is None else float(feedback)
        row = np.array([[fmt_idx, day_idx, hour, capacity, staff_size, fb]])
        pred = float(self.model.predict(row)[0])
        return max(0.0, min(1.0, pred))


# ── Public API ──────────────────────────────────────────────────────────

def recommend(facts: Sequence[dict[str, Any]],
              pretrained: Recommender | None = None) -> dict[str, Any]:
    """Produce the full recommendation payload from a list of event facts.

    `facts` matches the shape built by Java's `EventAiService.eventFacts`:
        { title, format, startDate, dayOfWeek, capacity, rsvpConfirmed,
          scannedAttendees, attendanceRate, staff, feedbackCount,
          feedbackComposite, topTags }
    """

    clean = [f for f in facts if f and f.get("format")]
    if not clean:
        return _empty_response("Aucun événement passé disponible pour l'analyse.")

    # ── 1) Train (or reuse) the ML model ───────────────────────────────
    model = pretrained if (pretrained and _SKLEARN) else _train_if_possible(clean)
    model_trained = model is not None

    # ── 2) Format aggregation ──────────────────────────────────────────
    by_format: dict[str, list[dict]] = defaultdict(list)
    for f in clean:
        by_format[str(f["format"]).lower()].append(f)

    top_formats = []
    for fmt, items in by_format.items():
        metrics = _metrics(items)
        pred = _model_predict_bucket(model, items, format_override=fmt) if model_trained else None
        top_formats.append({
            "format": fmt,
            "totalEvents": metrics["totalEvents"],
            "totalAttendees": metrics["totalAttendees"],
            "avgAttendanceRate": metrics["avgAttendanceRate"],
            "avgRsvpRate": metrics["avgRsvpRate"],
            "avgFeedback": metrics["avgFeedback"],
            "score": _composite_score(metrics, pred),
            "confidence": _confidence(metrics["totalEvents"]),
            "rationale": _format_rationale(fmt, metrics, pred),
        })
    top_formats.sort(key=lambda x: x["score"], reverse=True)

    # ── 3) Staff aggregation ───────────────────────────────────────────
    staff_groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for f in clean:
        for raw in (f.get("staff") or []):
            name, role = _split_name_role(str(raw))
            if name:
                staff_groups[(name, role)].append(f)

    top_staff = []
    for (name, role), items in staff_groups.items():
        metrics = _metrics(items)
        top_staff.append({
            "name": name,
            "role": role,
            "totalEvents": metrics["totalEvents"],
            "avgAttendanceRate": metrics["avgAttendanceRate"],
            "avgFeedback": metrics["avgFeedback"],
            "score": _staff_score(metrics),
            "confidence": _confidence(metrics["totalEvents"]),
            "rationale": _staff_rationale(name, metrics),
        })
    top_staff.sort(key=lambda x: x["score"], reverse=True)
    top_staff = top_staff[:8]

    # ── 4) Timing aggregation (day × time-of-day) ──────────────────────
    by_day: dict[str, list[dict]] = defaultdict(list)
    by_slot: dict[str, list[dict]] = defaultdict(list)
    for f in clean:
        dow = str(f.get("dayOfWeek") or "").upper()
        hour = _parse_hour(f.get("startDate"))
        slot = _time_slot(hour) if hour is not None else None
        if dow:
            by_day[dow].append(f)
        if slot:
            by_slot[slot].append(f)

    top_timing = []
    for dow, items in by_day.items():
        metrics = _metrics(items)
        avg_h = _average_hour(items)
        top_timing.append({
            "label": _title(dow),
            "slot": None,
            "dayOfWeek": dow,
            "totalEvents": metrics["totalEvents"],
            "avgAttendanceRate": metrics["avgAttendanceRate"],
            "avgHour": avg_h,
            "score": _timing_score(metrics),
            "confidence": _confidence(metrics["totalEvents"]),
        })
    top_timing.sort(key=lambda x: x["score"], reverse=True)
    top_timing = top_timing[:3]

    # ── 5) Pick suggested format / staff / timing ──────────────────────
    suggested_format = _pick_suggested(top_formats, "format")
    suggested_staff = [{"name": s["name"], "role": s["role"]}
                       for s in top_staff if s["confidence"] != "low"][:3]
    if not suggested_staff and top_staff:
        suggested_staff = [{"name": top_staff[0]["name"], "role": top_staff[0]["role"]}]

    suggested_timing: dict[str, Any] | None = None
    if top_timing:
        best_day = top_timing[0]
        # Pick the dominant slot for that day specifically, falling back to
        # the overall best slot if the day has no obvious favourite.
        day_slots = defaultdict(list)
        for f in by_day.get(best_day["dayOfWeek"], []):
            h = _parse_hour(f.get("startDate"))
            if h is not None:
                day_slots[_time_slot(h)].append(f)
        if day_slots:
            dominant_slot = max(day_slots.items(), key=lambda kv: len(kv[1]))[0]
        elif by_slot:
            dominant_slot = max(by_slot.items(), key=lambda kv: _timing_score(_metrics(kv[1])))[0]
        else:
            dominant_slot = _time_slot(best_day["avgHour"]) or "evening"

        hour = max(8, min(20, best_day["avgHour"] or 18))
        suggested_date = _next_occurrence(best_day["dayOfWeek"], hour)
        suggested_timing = {
            "dayOfWeek": _title(best_day["dayOfWeek"]),
            "timeOfDay": dominant_slot,
            "suggestedDate": suggested_date.strftime("%Y-%m-%dT%H:%M"),
            "typicalHour": hour,
            "score": best_day["score"],
            "confidence": best_day["confidence"],
            "rationale": (
                f"Sur les événements du {DAY_FR.get(best_day['dayOfWeek'], _title(best_day['dayOfWeek']).lower())} passés, "
                f"le taux de présence moyen est de "
                f"{int(round(best_day['avgAttendanceRate']*100))}% "
                f"({best_day['totalEvents']} observation(s))."
            ),
        }

    # ── 6) Insights, next actions, caveats ─────────────────────────────
    insights = _insights(clean, top_formats, top_staff, top_timing, model)
    next_actions = _next_actions(top_formats, top_staff, suggested_timing)
    caveats = _caveats(clean, model_trained)

    return {
        "totalPastEvents": len(clean),
        "topFormats": top_formats[:5],
        "topStaff": top_staff,
        "insights": insights,
        "suggestedFormat": suggested_format,
        "suggestedStaff": suggested_staff,
        "suggestedTiming": suggested_timing,
        "topTiming": top_timing,
        "nextActions": next_actions,
        "caveats": caveats,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        # Metadata for the UI badge — "mlrf" = "ML RandomForest (ours)"
        "source": "custom-ml" if model_trained else "custom-stats",
        "model": "RandomForestRegressor (scikit-learn)" if model_trained else "aggregation-only",
    }


# ── Training ────────────────────────────────────────────────────────────

def train(facts: Sequence[dict[str, Any]]) -> Recommender | None:
    """Fit a RandomForestRegressor on the given facts.

    Returns None if scikit-learn is unavailable or there are fewer than 4
    usable rows — the caller should then rely on the aggregation-only
    pipeline (still fully deterministic, just without the ML boost).
    """
    return _train_if_possible(facts)


def _train_if_possible(facts: Sequence[dict[str, Any]]) -> Recommender | None:
    if not _SKLEARN:
        log.info("scikit-learn not installed — skipping ML training.")
        return None
    rows = _feature_matrix(facts)
    if len(rows["y"]) < 4:
        log.info("Only %d usable rows — skipping ML training (need ≥ 4).", len(rows["y"]))
        return None

    fmt_enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    day_enc = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)
    fmt_col = fmt_enc.fit_transform(np.array(rows["formats"]).reshape(-1, 1))
    day_col = day_enc.fit_transform(np.array(rows["days"]).reshape(-1, 1))
    X = np.hstack([
        fmt_col,
        day_col,
        np.array(rows["hours"]).reshape(-1, 1),
        np.array(rows["capacity"]).reshape(-1, 1),
        np.array(rows["staff_size"]).reshape(-1, 1),
        np.array(rows["feedback"]).reshape(-1, 1),
    ])
    y = np.array(rows["y"])

    model = RandomForestRegressor(
        n_estimators=80, max_depth=5, min_samples_leaf=1, random_state=42
    )
    model.fit(X, y)
    log.info("Recommender trained on %d events; R² on train = %.3f",
             len(y), model.score(X, y))
    return Recommender(
        model=model,
        format_encoder=fmt_enc,
        day_encoder=day_enc,
        feature_names=["format", "dayOfWeek", "hour", "capacity",
                       "staffSize", "feedbackComposite"],
    )


def _feature_matrix(facts: Sequence[dict[str, Any]]) -> dict[str, list]:
    formats, days, hours, capacity, staff_size, feedback, y = (
        [], [], [], [], [], [], [])
    for f in facts:
        rate = _rate_of(f)
        if rate is None:
            continue
        formats.append(str(f.get("format") or "unspecified").lower())
        days.append(str(f.get("dayOfWeek") or "UNKNOWN").upper())
        h = _parse_hour(f.get("startDate"))
        hours.append(int(h) if h is not None else 18)
        capacity.append(int(f.get("capacity") or 0))
        staff_size.append(len(f.get("staff") or []))
        fb = f.get("feedbackComposite")
        feedback.append(-1.0 if fb is None else float(fb))
        y.append(float(rate))
    return dict(formats=formats, days=days, hours=hours,
                capacity=capacity, staff_size=staff_size,
                feedback=feedback, y=y)


# ── Scoring helpers ─────────────────────────────────────────────────────

def _metrics(items: list[dict]) -> dict[str, Any]:
    rates, rsvp_rates, feedbacks, attendees = [], [], [], 0
    for i in items:
        r = _rate_of(i)
        if r is not None:
            rates.append(r)
        cap = i.get("capacity") or 0
        rsvp = i.get("rsvpConfirmed") or 0
        if cap > 0:
            rsvp_rates.append(min(1.0, rsvp / cap))
        fb = i.get("feedbackComposite")
        if fb is not None:
            feedbacks.append(float(fb))
        attendees += int(i.get("scannedAttendees") or rsvp)
    return {
        "totalEvents": len(items),
        "totalAttendees": attendees,
        "avgAttendanceRate": round(float(np.mean(rates)), 3) if rates else 0.0,
        "avgRsvpRate": round(float(np.mean(rsvp_rates)), 3) if rsvp_rates else 0.0,
        "avgFeedback": round(float(np.mean(feedbacks)), 2) if feedbacks else None,
    }


def _composite_score(metrics: dict, predicted_rate: float | None) -> float:
    """Blend observed metrics with the ML-predicted attendance rate."""
    att = metrics["avgAttendanceRate"]
    rsvp = metrics["avgRsvpRate"]
    fb = metrics["avgFeedback"]
    fb_norm = 0.6 if fb is None else (fb - 1) / 4.0
    observed = 0.45 * att + 0.25 * rsvp + 0.30 * fb_norm
    if predicted_rate is None:
        return round(100 * observed, 1)
    # 65% observed, 35% ML-predicted (model is the tiebreaker, not the oracle)
    return round(100 * (0.65 * observed + 0.35 * predicted_rate), 1)


def _staff_score(metrics: dict) -> float:
    att = metrics["avgAttendanceRate"]
    fb = metrics["avgFeedback"]
    fb_norm = 0.6 if fb is None else (fb - 1) / 4.0
    return round(100 * (0.55 * att + 0.45 * fb_norm), 1)


def _timing_score(metrics: dict) -> float:
    att = metrics["avgAttendanceRate"]
    fb = metrics["avgFeedback"]
    fb_norm = 0.6 if fb is None else (fb - 1) / 4.0
    return round(100 * (0.6 * att + 0.4 * fb_norm), 1)


def _confidence(n: int) -> str:
    for threshold, label in CONF_THRESHOLDS:
        if n >= threshold:
            return label
    return "low"


def _model_predict_bucket(model: Recommender, items: list[dict],
                          format_override: str | None = None) -> float | None:
    """Predict the mean attendance rate for the bucket with the ML model."""
    if not items:
        return None
    preds = []
    for it in items:
        h = _parse_hour(it.get("startDate"))
        try:
            preds.append(model.predict(
                format_=format_override or str(it.get("format") or "unspecified").lower(),
                day=str(it.get("dayOfWeek") or "UNKNOWN").upper(),
                hour=int(h) if h is not None else 18,
                capacity=int(it.get("capacity") or 0),
                staff_size=len(it.get("staff") or []),
                feedback=it.get("feedbackComposite"),
            ))
        except Exception as exc:  # robustness: never fail the whole call
            log.debug("Model prediction failed for one event: %s", exc)
    return float(np.mean(preds)) if preds else None


# ── Insight generation (plain-language, no LLM) ─────────────────────────

def _insights(facts: list[dict], top_formats: list[dict], top_staff: list[dict],
              top_timing: list[dict], model: Recommender | None) -> list[str]:
    out: list[str] = []

    # 1) Best vs worst format
    if len(top_formats) >= 2:
        best, worst = top_formats[0], top_formats[-1]
        diff = (best["avgAttendanceRate"] - worst["avgAttendanceRate"]) * 100
        if diff >= 10:
            out.append(
                f"Les {best['format']}s attirent en moyenne "
                f"{int(round(diff))}% d'audience en plus que les "
                f"{worst['format']}s dans votre club."
            )

    # 2) Capacity utilisation
    rates = [_rate_of(f) for f in facts]
    rates = [r for r in rates if r is not None]
    if rates:
        avg_pct = int(round(100 * np.mean(rates)))
        if avg_pct < 50:
            out.append(
                f"Le taux de remplissage moyen n'est que de {avg_pct}% — "
                "envisagez une salle plus petite ou des rappels plus insistants."
            )
        elif avg_pct >= 80:
            out.append(
                f"Le taux de remplissage moyen atteint {avg_pct}% — "
                "vous pouvez probablement augmenter la capacité."
            )

    # 3) Feature importances (ML explainability — this is the hero insight)
    if model is not None:
        importances = list(zip(model.feature_names, model.model.feature_importances_))
        importances.sort(key=lambda t: t[1], reverse=True)
        top2 = importances[:2]
        if top2 and top2[0][1] > 0.05:
            pretty = {
                "format": "le format",
                "dayOfWeek": "le jour de la semaine",
                "hour": "l'heure de début",
                "capacity": "la capacité de la salle",
                "staffSize": "la taille de l'équipe",
                "feedbackComposite": "la note moyenne passée",
            }
            top_label = pretty.get(top2[0][0], top2[0][0])
            second_label = pretty.get(top2[1][0], top2[1][0]) if len(top2) > 1 else None
            msg = (f"Le modèle RandomForest identifie {top_label} comme "
                   f"le facteur le plus explicatif de la fréquentation "
                   f"(importance {int(round(top2[0][1]*100))}%)")
            if second_label and top2[1][1] > 0.05:
                msg += f", suivi de {second_label} ({int(round(top2[1][1]*100))}%)"
            msg += "."
            out.append(msg)

    # 4) Best day-of-week
    if top_timing:
        best = top_timing[0]
        day_label = DAY_FR.get(best["dayOfWeek"], _title(best["dayOfWeek"]).lower())
        out.append(
            f"Les événements programmés un {day_label} "
            f"affichent un taux de présence de "
            f"{int(round(best['avgAttendanceRate']*100))}% — c'est votre meilleur créneau."
        )

    # 5) Top staff signal
    if top_staff and top_staff[0]["confidence"] != "low":
        s = top_staff[0]
        out.append(
            f"{s['name']} a encadré {s['totalEvents']} événement(s) avec un "
            f"score moyen de {s['score']}/100 — fiable pour le prochain."
        )

    return out[:6]


def _next_actions(top_formats: list[dict], top_staff: list[dict],
                  suggested_timing: dict | None) -> list[str]:
    actions: list[str] = []
    if top_formats:
        actions.append(
            f"Programmer le prochain événement en format « {top_formats[0]['format']} » — "
            f"score {top_formats[0]['score']}/100 sur l'historique."
        )
    if suggested_timing:
        dow_en = suggested_timing["dayOfWeek"].upper()
        day_fr = DAY_FR.get(dow_en, suggested_timing["dayOfWeek"].lower())
        slot_fr = {"morning": "matinée", "afternoon": "après-midi",
                   "evening": "soirée", "night": "fin de soirée"}
        slot = slot_fr.get(suggested_timing["timeOfDay"], suggested_timing["timeOfDay"])
        actions.append(
            f"Viser un {day_fr} en {slot} "
            f"(vers {suggested_timing['typicalHour']}h)."
        )
    if top_staff:
        names = ", ".join(s["name"] for s in top_staff[:2] if s["confidence"] != "low")
        if names:
            actions.append(f"Impliquer {names} dans l'équipe encadrante.")
    if not actions:
        actions.append("Accumuler au moins 5 événements pour débloquer des recommandations fiables.")
    return actions[:4]


def _caveats(facts: list[dict], model_trained: bool) -> list[str]:
    out = []
    if len(facts) < 3:
        out.append("Très peu de données historiques — les recommandations sont indicatives.")
    if not model_trained:
        out.append(
            "Modèle ML non entraîné (moins de 4 événements exploitables) : les "
            "scores proviennent uniquement de l'agrégation statistique."
        )
    fb_count = sum(1 for f in facts if f.get("feedbackComposite") is not None)
    if fb_count < max(2, len(facts) // 2):
        out.append(
            "Peu d'événements ont des retours participants : la dimension satisfaction "
            "pèse faiblement dans les scores."
        )
    return out


# ── Formatting helpers ─────────────────────────────────────────────────

def _rate_of(fact: dict) -> float | None:
    """Return the observed attendance rate of one event, or None."""
    r = fact.get("attendanceRate")
    if r is not None:
        try:
            return max(0.0, min(1.0, float(r)))
        except (TypeError, ValueError):
            pass
    cap = fact.get("capacity") or 0
    if cap <= 0:
        return None
    num = fact.get("scannedAttendees") or fact.get("rsvpConfirmed") or 0
    return max(0.0, min(1.0, float(num) / float(cap)))


def _parse_hour(iso: Any) -> int | None:
    if iso is None:
        return None
    s = str(iso)
    if len(s) < 13:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).hour
    except Exception:
        try:
            return datetime.strptime(s[:16], "%Y-%m-%dT%H:%M").hour
        except Exception:
            return None


def _time_slot(hour: int | None) -> str | None:
    if hour is None:
        return None
    if hour < 12:
        return "morning"
    if hour < 17:
        return "afternoon"
    if hour < 21:
        return "evening"
    return "night"


def _average_hour(items: list[dict]) -> int:
    hours = [_parse_hour(i.get("startDate")) for i in items]
    hours = [h for h in hours if h is not None]
    return int(round(np.mean(hours))) if hours else 18


def _split_name_role(raw: str) -> tuple[str, str]:
    """The Java side encodes staff as "Name (role)". Parse it back."""
    raw = raw.strip()
    if not raw:
        return "", ""
    if "(" in raw and raw.endswith(")"):
        i = raw.index("(")
        return raw[:i].strip(), raw[i + 1:-1].strip()
    return raw, ""


def _title(day: str) -> str:
    if not day:
        return ""
    return day[0].upper() + day[1:].lower()


def _pick_suggested(top: list[dict], key: str) -> str | None:
    for t in top:
        if t["confidence"] != "low":
            return t[key]
    return top[0][key] if top else None


def _next_occurrence(day_of_week: str, hour: int) -> datetime:
    try:
        target = DAY_ORDER.index(day_of_week.upper())
    except ValueError:
        target = 5  # default: Saturday
    today = datetime.now().replace(hour=hour, minute=0, second=0, microsecond=0)
    delta = (target - today.weekday() + 7) % 7
    if delta == 0:
        delta = 7  # never propose "today"
    return today + timedelta(days=delta)


def _format_rationale(fmt: str, metrics: dict, predicted: float | None) -> str:
    base = (f"{metrics['totalEvents']} événement(s), "
            f"présence moyenne {int(round(metrics['avgAttendanceRate']*100))}%")
    if metrics["avgFeedback"] is not None:
        base += f", feedback {metrics['avgFeedback']}/5"
    if predicted is not None:
        base += f" ; modèle prédit {int(round(predicted*100))}%"
    base += "."
    return base


def _staff_rationale(name: str, metrics: dict) -> str:
    msg = (f"{name} : {metrics['totalEvents']} événement(s), "
           f"présence {int(round(metrics['avgAttendanceRate']*100))}%")
    if metrics["avgFeedback"] is not None:
        msg += f", feedback {metrics['avgFeedback']}/5"
    return msg + "."


def _empty_response(reason: str) -> dict[str, Any]:
    return {
        "totalPastEvents": 0,
        "topFormats": [],
        "topStaff": [],
        "insights": [],
        "suggestedFormat": None,
        "suggestedStaff": [],
        "suggestedTiming": None,
        "topTiming": [],
        "nextActions": [],
        "caveats": [reason],
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "source": "custom-empty",
        "model": "none",
        "emptyState": reason,
    }


def _encode(encoder: Any, value: str) -> float:
    arr = np.array([[value]])
    return float(encoder.transform(arr)[0][0])
