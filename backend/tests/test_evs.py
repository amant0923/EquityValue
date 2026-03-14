"""Unit tests for EVS (Equity Value Score) computation."""
import pytest
from evs.score import compute_evs


@pytest.fixture
def healthy_undervalued():
    """Stock with strong fundamentals and significant upside."""
    return {
        "consensus_upside_pct": 35.0,
        "altman_z_score": 4.5,
        "piotroski_score": 8,
        "debt_to_equity": 0.4,
        "profit_margin": 0.25,
        "analyst_target_upside_pct": 20.0,
        "model_analyst_divergence_pct": 10.0,
        "revenue_growth": 0.15,
        "eps_growth": 0.18,
        "fcf_growth": 0.12,
        "price_range_52w": 0.4,
        "earnings_smoothing_divergence": 0.05,
        "investment_quality": "neutral",
    }


@pytest.fixture
def overvalued_risky():
    """Stock with weak fundamentals and significant downside."""
    return {
        "consensus_upside_pct": -30.0,
        "altman_z_score": 1.2,
        "piotroski_score": 2,
        "debt_to_equity": 3.5,
        "profit_margin": -0.05,
        "analyst_target_upside_pct": -15.0,
        "model_analyst_divergence_pct": 50.0,
        "revenue_growth": -0.10,
        "eps_growth": -0.25,
        "fcf_growth": -0.15,
        "price_range_52w": 0.95,
        "earnings_smoothing_divergence": 0.45,
        "investment_quality": "negative",
    }


def test_healthy_undervalued_scores_high(healthy_undervalued):
    result = compute_evs(healthy_undervalued)
    assert result["score"] >= 75
    assert result["verdict"] in ("Strong Buy", "Buy")
    assert "valuation" in result["components"]
    assert "health" in result["components"]
    assert "analyst" in result["components"]
    assert "growth" in result["components"]
    assert "risk" in result["components"]


def test_overvalued_risky_scores_low(overvalued_risky):
    result = compute_evs(overvalued_risky)
    assert result["score"] <= 30
    assert result["verdict"] in ("Sell", "Strong Sell")


def test_score_is_bounded_0_100(healthy_undervalued, overvalued_risky):
    for data in [healthy_undervalued, overvalued_risky]:
        result = compute_evs(data)
        assert 0 <= result["score"] <= 100


def test_missing_fields_dont_crash():
    result = compute_evs({})
    assert 0 <= result["score"] <= 100
    assert result["verdict"] in ("Strong Buy", "Buy", "Hold", "Sell", "Strong Sell")


def test_components_sum_roughly_to_score(healthy_undervalued):
    result = compute_evs(healthy_undervalued)
    c = result["components"]
    weighted_sum = (
        c["valuation"] * 0.35 +
        c["health"] * 0.20 +
        c["analyst"] * 0.15 +
        c["growth"] * 0.15 +
        c["risk"] * 0.15
    )
    assert abs(result["score"] - round(weighted_sum)) <= 1
