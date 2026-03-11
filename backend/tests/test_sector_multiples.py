"""Tests for sector_multiples module."""
import pytest
from unittest.mock import patch, MagicMock
from valuation.sector_multiples import (
    get_sector_multiples,
    get_risk_free_rate,
    _compute_sector_multiples,
    _rfr_cache,
    _multiples_cache,
    HARDCODED_FALLBACK,
)


def test_compute_sector_multiples_from_rows():
    """Given stock rows, compute medians per sector. Need >= 3 rows per sector for _safe_median."""
    rows = [
        {"sector": "Technology", "pe_ratio": 25, "ev_to_ebitda": 20, "ps_ratio": 5,
         "pb_ratio": 7, "free_cashflow": 100, "market_cap": 3000, "revenue_growth": 0.10},
        {"sector": "Technology", "pe_ratio": 30, "ev_to_ebitda": 24, "ps_ratio": 7,
         "pb_ratio": 9, "free_cashflow": 200, "market_cap": 5000, "revenue_growth": 0.12},
        {"sector": "Technology", "pe_ratio": 28, "ev_to_ebitda": 22, "ps_ratio": 6,
         "pb_ratio": 8, "free_cashflow": 150, "market_cap": 4000, "revenue_growth": 0.11},
        {"sector": "Energy", "pe_ratio": 10, "ev_to_ebitda": 7, "ps_ratio": 1.2,
         "pb_ratio": 1.5, "free_cashflow": 50, "market_cap": 800, "revenue_growth": 0.03},
        {"sector": "Energy", "pe_ratio": 12, "ev_to_ebitda": 8, "ps_ratio": 1.4,
         "pb_ratio": 1.8, "free_cashflow": 60, "market_cap": 900, "revenue_growth": 0.04},
        {"sector": "Energy", "pe_ratio": 11, "ev_to_ebitda": 7.5, "ps_ratio": 1.3,
         "pb_ratio": 1.6, "free_cashflow": 55, "market_cap": 850, "revenue_growth": 0.035},
    ]
    result = _compute_sector_multiples(rows)
    assert "Technology" in result
    assert "Energy" in result
    assert "default" in result
    # Median of [25, 28, 30] = 28
    assert result["Technology"]["pe"] == pytest.approx(28.0)
    # FCF yield median: [100/3000, 150/4000, 200/5000] = [0.0333, 0.0375, 0.04] → median 0.0375
    assert result["Technology"]["fcf_yield"] == pytest.approx(0.0375, abs=0.002)


def test_compute_sector_multiples_skips_nulls():
    """Null values should be filtered out; sectors with < 3 values fall back to hardcoded."""
    rows = [
        {"sector": "Technology", "pe_ratio": 25, "ev_to_ebitda": None, "ps_ratio": 5,
         "pb_ratio": 7, "free_cashflow": None, "market_cap": 3000, "revenue_growth": 0.10},
    ]
    result = _compute_sector_multiples(rows)
    # Only 1 row, so _safe_median returns None → falls back to HARDCODED_FALLBACK
    assert result["Technology"]["ev_ebitda"] == HARDCODED_FALLBACK["Technology"]["ev_ebitda"]
    # pe has only 1 value (< 3), so also falls back
    assert result["Technology"]["pe"] == HARDCODED_FALLBACK["Technology"]["pe"]


def test_hardcoded_fallback_has_all_sectors():
    """Fallback dict must cover all S&P 500 sectors."""
    required = ["Technology", "Healthcare", "Energy", "Industrials",
                 "Materials", "Consumer Discretionary", "Consumer Staples",
                 "Utilities", "Real Estate", "Communication Services",
                 "Financial Services", "default"]
    for sector in required:
        assert any(s in HARDCODED_FALLBACK for s in [sector]), f"Missing {sector}"


def test_get_risk_free_rate_returns_float():
    """Risk-free rate should be a reasonable float."""
    # Reset cache to force fresh fetch
    _rfr_cache["data"] = None
    _rfr_cache["ts"] = 0
    with patch("valuation.sector_multiples.fmp_get_first") as mock_fmp:
        mock_fmp.return_value = {"year10": 4.25}
        rate = get_risk_free_rate()
        assert 0.01 <= rate <= 0.10
        assert rate == pytest.approx(0.0425)


def test_get_risk_free_rate_fallback():
    """When FMP fails, return hardcoded fallback."""
    _rfr_cache["data"] = None
    _rfr_cache["ts"] = 0
    with patch("valuation.sector_multiples.fmp_get_first") as mock_fmp:
        mock_fmp.return_value = None
        rate = get_risk_free_rate()
        assert rate == 0.043


def test_get_sector_multiples_from_supabase():
    """When Supabase returns enough rows, compute live multiples."""
    _multiples_cache["data"] = None
    _multiples_cache["ts"] = 0
    fake_rows = [
        {"sector": "Technology", "pe_ratio": 25 + i, "ev_to_ebitda": 20 + i,
         "ps_ratio": 5, "pb_ratio": 7, "free_cashflow": 100, "market_cap": 3000,
         "revenue_growth": 0.10, "ev_to_revenue": 6.0}
        for i in range(60)  # >= 50 rows needed
    ]
    with patch("valuation.sector_multiples._sb") as mock_sb:
        mock_table = MagicMock()
        mock_sb.table.return_value = mock_table
        mock_table.select.return_value = mock_table
        mock_table.not_.return_value = mock_table
        mock_table.is_.return_value = mock_table
        mock_table.execute.return_value = MagicMock(data=fake_rows)
        result = get_sector_multiples()
        assert "Technology" in result
        assert "default" in result


def test_get_sector_multiples_fallback_on_error():
    """When Supabase fails, return HARDCODED_FALLBACK."""
    _multiples_cache["data"] = None
    _multiples_cache["ts"] = 0
    with patch("valuation.sector_multiples._sb") as mock_sb:
        mock_sb.table.side_effect = Exception("connection error")
        result = get_sector_multiples()
        assert result == HARDCODED_FALLBACK
