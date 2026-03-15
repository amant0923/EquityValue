from evs.trends import compute_trend_metrics
from datetime import date, timedelta

def test_compute_trend_improving():
    today = date.today()
    history = [
        {"score": 70, "verdict": "Buy", "computed_at": str(today)},
        {"score": 65, "verdict": "Buy", "computed_at": str(today - timedelta(days=7))},
        {"score": 55, "verdict": "Hold", "computed_at": str(today - timedelta(days=30))},
    ]
    result = compute_trend_metrics(history)
    assert result["trend_7d"] == 5
    assert result["trend_30d"] == 15
    assert result["trend_direction"] == "improving"

def test_compute_trend_deteriorating():
    today = date.today()
    history = [
        {"score": 40, "verdict": "Hold", "computed_at": str(today)},
        {"score": 50, "verdict": "Hold", "computed_at": str(today - timedelta(days=7))},
        {"score": 65, "verdict": "Buy", "computed_at": str(today - timedelta(days=30))},
    ]
    result = compute_trend_metrics(history)
    assert result["trend_7d"] == -10
    assert result["trend_30d"] == -25
    assert result["trend_direction"] == "deteriorating"

def test_compute_trend_stable():
    today = date.today()
    history = [
        {"score": 60, "verdict": "Buy", "computed_at": str(today)},
        {"score": 58, "verdict": "Hold", "computed_at": str(today - timedelta(days=7))},
        {"score": 59, "verdict": "Hold", "computed_at": str(today - timedelta(days=30))},
    ]
    result = compute_trend_metrics(history)
    assert result["trend_direction"] == "stable"

def test_compute_trend_insufficient_data():
    result = compute_trend_metrics([])
    assert result["trend_7d"] is None
    assert result["trend_30d"] is None
    assert result["trend_direction"] == "unknown"
