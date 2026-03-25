"""Tests for the normalise() function that maps raw data fields for valuation models."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import normalise


def test_maps_current_price_to_price():
    data = {"current_price": 150.0}
    result = normalise(data)
    assert result["price"] == 150.0


def test_does_not_overwrite_existing_price():
    data = {"current_price": 150.0, "price": 200.0}
    result = normalise(data)
    assert result["price"] == 200.0


def test_maps_book_value_to_book_value_per_share():
    data = {"book_value": 25.0}
    result = normalise(data)
    assert result["book_value_per_share"] == 25.0


def test_maps_total_cash_to_cash():
    data = {"total_cash": 1000000}
    result = normalise(data)
    assert result["cash"] == 1000000


def test_maps_ev_to_ebitda():
    data = {"ev_to_ebitda": 15.5}
    result = normalise(data)
    assert result["ev_ebitda"] == 15.5


def test_calculates_ev_ebitda_from_components():
    data = {"enterprise_value": 1000000, "ebitda": 100000}
    result = normalise(data)
    assert result["ev_ebitda"] == 10.0


def test_calculates_ebitda_margin():
    data = {"ebitda": 200000, "revenue": 1000000}
    result = normalise(data)
    assert abs(result["ebitda_margin"] - 0.2) < 0.001


def test_normalises_percentage_fields_from_percent_to_decimal():
    """Fields like ROE stored as 27 should become 0.27."""
    data = {"roe": 27.0, "profit_margin": 15.0}
    result = normalise(data)
    assert result["roe"] == 0.27
    assert result["profit_margin"] == 0.15


def test_leaves_decimal_percentages_alone():
    """Fields already as decimals (0.27) should stay as 0.27."""
    data = {"roe": 0.27, "profit_margin": 0.15}
    result = normalise(data)
    assert result["roe"] == 0.27
    assert result["profit_margin"] == 0.15


def test_handles_empty_data():
    result = normalise({})
    assert isinstance(result, dict)


def test_handles_none_values_gracefully():
    data = {"current_price": None, "ebitda": None, "revenue": None}
    result = normalise(data)
    assert result.get("price") is None


def test_ev_to_revenue_calculation():
    data = {"enterprise_value": 5000000, "revenue": 1000000}
    result = normalise(data)
    assert result["ev_to_revenue"] == 5.0


def test_zero_revenue_does_not_divide():
    data = {"enterprise_value": 5000000, "revenue": 0}
    result = normalise(data)
    # Should not crash; ev_to_revenue stays unset or 0
    assert result.get("ev_to_revenue") is None or result.get("ev_to_revenue") == 0


def test_zero_ebitda_does_not_divide():
    data = {"enterprise_value": 5000000, "ebitda": 0}
    result = normalise(data)
    # Should not crash
    assert result.get("ev_ebitda") is None or result.get("ev_ebitda") == 0
