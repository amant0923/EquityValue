from datetime import date, timedelta


def compute_trend_metrics(history: list[dict]) -> dict:
    """Compute EVS trend from historical scores.

    Args:
        history: list of {score, verdict, computed_at} sorted newest first

    Returns:
        {trend_7d, trend_30d, trend_direction, days_at_current_verdict}
    """
    if not history:
        return {
            "trend_7d": None,
            "trend_30d": None,
            "trend_direction": "unknown",
            "days_at_current_verdict": 0,
        }

    today = date.fromisoformat(str(history[0]["computed_at"])[:10])
    current_score = history[0]["score"]
    current_verdict = history[0]["verdict"]

    # Find scores closest to 7 and 30 days ago
    score_7d = _find_closest_score(history, today - timedelta(days=7))
    score_30d = _find_closest_score(history, today - timedelta(days=30))

    trend_7d = current_score - score_7d if score_7d is not None else None
    trend_30d = current_score - score_30d if score_30d is not None else None

    # Determine direction based on 30d trend (or 7d if 30d unavailable)
    ref_trend = trend_30d if trend_30d is not None else trend_7d
    if ref_trend is None:
        direction = "unknown"
    elif ref_trend >= 5:
        direction = "improving"
    elif ref_trend <= -5:
        direction = "deteriorating"
    else:
        direction = "stable"

    # Days at current verdict
    days_at_verdict = 0
    for entry in history:
        if entry["verdict"] == current_verdict:
            days_at_verdict += 1
        else:
            break

    return {
        "trend_7d": trend_7d,
        "trend_30d": trend_30d,
        "trend_direction": direction,
        "days_at_current_verdict": days_at_verdict,
    }


def _find_closest_score(history: list[dict], target_date: date) -> int | None:
    """Find score closest to target_date within 3-day tolerance."""
    best = None
    best_diff = float("inf")
    for entry in history:
        d = date.fromisoformat(str(entry["computed_at"])[:10])
        diff = abs((d - target_date).days)
        if diff < best_diff:
            best_diff = diff
            best = entry["score"]
    return best if best_diff <= 3 else None
