"""Tests for EVS input extraction."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from evs.extract import extract_evs_inputs


def test_extract_basic_inputs():
    stock_data = {
        "current_price": 150,
        "target_price": 180,
        "debt_to_equity": 0.5,
        "profit_margin": 0.15,
        "revenue_growth": 0.10,
        "earnings_growth": 0.08,
        "52w_high": 200,
        "52w_low": 100,
    }
    valuation_result = {
        "consensus": {"upside_pct": 20.0, "average_intrinsic_value": 175},
        "signals": {"investment_quality": "neutral", "earnings_smoothing": {}},
    }
    scores = {"altman_z_score": 3.5, "piotroski_score": 7}

    result = extract_evs_inputs(stock_data, valuation_result, scores)

    assert result["consensus_upside_pct"] == 20.0
    assert result["altman_z_score"] == 3.5
    assert result["piotroski_score"] == 7
    assert result["debt_to_equity"] == 0.5
    assert result["profit_margin"] == 0.15


def test_extract_with_empty_data():
    result = extract_evs_inputs({}, {"consensus": {}, "signals": {}}, {})
    assert result["consensus_upside_pct"] == 0.0
    assert result["altman_z_score"] is None


def test_extract_analyst_upside_calculation():
    stock_data = {"target_price": 200, "current_price": 100}
    valuation_result = {
        "consensus": {"upside_pct": 0, "average_intrinsic_value": 150},
        "signals": {},
    }
    result = extract_evs_inputs(stock_data, valuation_result)
    assert result["analyst_target_upside_pct"] == 100.0


def test_extract_price_range_calculation():
    stock_data = {"current_price": 150, "52w_high": 200, "52w_low": 100}
    valuation_result = {"consensus": {}, "signals": {}}
    result = extract_evs_inputs(stock_data, valuation_result)
    assert result["price_range_52w"] == 0.5


def test_extract_with_no_scores():
    stock_data = {"current_price": 100}
    valuation_result = {"consensus": {}, "signals": {}}
    result = extract_evs_inputs(stock_data, valuation_result)
    assert result["altman_z_score"] is None
    assert result["piotroski_score"] is None
