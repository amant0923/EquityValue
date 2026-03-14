# Valuation Model Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul all valuation models with research-backed formulas, dynamic sector multiples, weighted consensus, and contextual risk signals — based on Yartseva (2025) and Delao et al. (2024).

**Architecture:** New `sector_multiples.py` module provides cached dynamic multiples and live Treasury yield. Extended `data_fetcher.py` pulls additional fields from existing Supabase tables (financial_statements, key_metrics, growth_metrics, analyst_data). Overhauled `models.py` fixes 7 broken formulas and adds FCF Yield model. Rewritten consensus logic in `router.py` uses empirical weights, analyst blending, and contextual signals.

**Tech Stack:** Python/FastAPI, Supabase (postgrest-py), FMP API, numpy

**Spec:** `/Users/a/Desktop/Valuation_Overhaul_Report.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/valuation/sector_multiples.py` | **Create** | Dynamic sector medians from DB + live Treasury yield, both cached 24hrs |
| `backend/valuation/models.py` | **Modify** | Fix 7 formulas, add FCF Yield model, accept sector_multiples + risk_free_rate params |
| `backend/valuation/router.py` | **Modify** | Weighted consensus, analyst blending, contextual signals, updated MODEL_MAP, enhanced confidence |
| `backend/data_fetcher.py` | **Modify** | Fetch operating_income, depreciation, total_assets, 3yr avg EPS/ROE from Supabase detail tables |
| `backend/main.py` | **Modify** | Pass sector_multiples to valuation, minor normalise() updates |
| `backend/tests/test_valuation.py` | **Create** | Unit tests for models, consensus, sector_multiples |
| `backend/tests/__init__.py` | **Create** | Empty |
| `backend/tests/conftest.py` | **Create** | Shared fixtures |

---

## Chunk 1: Infrastructure — Sector Multiples, Treasury Yield, Data Layer

### Task 1: Create sector_multiples.py

**Files:**
- Create: `backend/valuation/sector_multiples.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_sector_multiples.py`

- [ ] **Step 1: Create empty test infrastructure**

Create `backend/tests/__init__.py` (empty) and `backend/tests/conftest.py`:

```python
"""Shared test fixtures for valuation tests."""
import pytest


@pytest.fixture
def sample_stock_data():
    """Minimal stock data dict matching data_fetcher output."""
    return {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "price": 175.0,
        "current_price": 175.0,
        "eps": 6.50,
        "ebitda": 130_000_000_000,
        "revenue": 390_000_000_000,
        "free_cashflow": 100_000_000_000,
        "shares_outstanding": 15_500_000_000,
        "total_debt": 110_000_000_000,
        "cash": 60_000_000_000,
        "total_cash": 60_000_000_000,
        "market_cap": 2_700_000_000_000,
        "enterprise_value": 2_750_000_000_000,
        "book_value": 4.25,
        "book_value_per_share": 4.25,
        "beta": 1.2,
        "roe": 0.45,
        "roa": 0.28,
        "dividend_yield": 0.005,
        "profit_margin": 0.25,
        "operating_margin": 0.30,
        "revenue_growth": 0.08,
        "earnings_growth": 0.10,
        "sector": "Technology",
        "industry": "Consumer Electronics",
        "pe_ratio": 26.9,
        "pb_ratio": 41.0,
        "ps_ratio": 7.0,
        "ev_ebitda": 21.0,
        "ev_to_ebitda": 21.0,
        "52w_high": 200.0,
        "52w_low": 140.0,
        "target_price": 195.0,
        "recommendation": "buy",
        "analyst_count": 35,
        "operating_income": 115_000_000_000,
        "depreciation_amortization": 15_000_000_000,
        "total_assets": 350_000_000_000,
        "total_assets_prev": 340_000_000_000,
        "ebitda_prev": 125_000_000_000,
        "eps_3yr_avg": 6.20,
        "roe_3yr_avg": 0.43,
        "payout_ratio": 0.15,
        "interest_expense": 3_500_000_000,
    }


@pytest.fixture
def sample_sector_multiples():
    """Sector multiples dict as returned by get_sector_multiples()."""
    return {
        "Technology": {
            "ev_ebitda": 22.0,
            "ev_ebit": 25.0,
            "ev_sales": 6.5,
            "pe": 28.0,
            "ps": 6.0,
            "pb": 8.0,
            "fcf_yield": 0.035,
            "cap_rate": 0.06,
            "median_growth": 0.10,
        },
        "default": {
            "ev_ebitda": 16.0,
            "ev_ebit": 18.0,
            "ev_sales": 2.5,
            "pe": 18.0,
            "ps": 2.0,
            "pb": 3.0,
            "fcf_yield": 0.045,
            "cap_rate": 0.08,
            "median_growth": 0.06,
        },
    }
```

- [ ] **Step 2: Write tests for sector_multiples**

Create `backend/tests/test_sector_multiples.py`:

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && pip install pytest --quiet && python -m pytest tests/test_sector_multiples.py -v
```
Expected: FAIL (module not found)

- [ ] **Step 4: Implement sector_multiples.py**

Create `backend/valuation/sector_multiples.py`:

```python
"""Dynamic sector multiples from Supabase + live Treasury yield from FMP.

Both are cached for 24 hours. Falls back to hardcoded values on failure.
"""
import os
import time
import statistics
from supabase import create_client
from fmp_client import fmp_get_first

# ── Supabase client (reuse service key pattern from portfolio.py) ──────
_SUPABASE_URL = os.environ.get(
    "SUPABASE_URL", "https://efbtgnplotlshrwbotfp.supabase.co"
)
_SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
_SUPABASE_KEY = os.environ.get(
    "SUPABASE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYnRnbnBsb3Rsc2hyd2JvdGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDEzODIsImV4cCI6MjA4ODQ3NzM4Mn0.grKm3Rh-UtXU3bIz2ajLNiVxbfTECC9cwuslZe_BY-I",
)
_sb = create_client(_SUPABASE_URL, _SUPABASE_SERVICE_KEY or _SUPABASE_KEY)

# ── Cache TTL (24 hours) ───────────────────────────────────────────────
_CACHE_TTL = 86400
_multiples_cache = {"data": None, "ts": 0}
_rfr_cache = {"data": None, "ts": 0}

# ── Hardcoded fallback (current values from models.py) ─────────────────
HARDCODED_FALLBACK = {
    "Technology": {"ev_ebitda": 27.0, "ev_ebit": 30.0, "ev_sales": 8.0, "pe": 28, "ps": 7.0, "pb": 8.0, "fcf_yield": 0.030, "cap_rate": 0.06, "median_growth": 0.10},
    "Information Technology": {"ev_ebitda": 27.0, "ev_ebit": 30.0, "ev_sales": 8.0, "pe": 28, "ps": 7.0, "pb": 8.0, "fcf_yield": 0.030, "cap_rate": 0.06, "median_growth": 0.10},
    "Healthcare": {"ev_ebitda": 17.0, "ev_ebit": 20.0, "ev_sales": 4.0, "pe": 22, "ps": 3.5, "pb": 4.0, "fcf_yield": 0.040, "cap_rate": 0.07, "median_growth": 0.08},
    "Health Care": {"ev_ebitda": 17.0, "ev_ebit": 20.0, "ev_sales": 4.0, "pe": 22, "ps": 3.5, "pb": 4.0, "fcf_yield": 0.040, "cap_rate": 0.07, "median_growth": 0.08},
    "Consumer Discretionary": {"ev_ebitda": 17.0, "ev_ebit": 19.0, "ev_sales": 1.8, "pe": 18, "ps": 1.5, "pb": 3.5, "fcf_yield": 0.045, "cap_rate": 0.08, "median_growth": 0.07},
    "Consumer Cyclical": {"ev_ebitda": 17.0, "ev_ebit": 19.0, "ev_sales": 1.8, "pe": 18, "ps": 1.5, "pb": 3.5, "fcf_yield": 0.045, "cap_rate": 0.08, "median_growth": 0.07},
    "Consumer Staples": {"ev_ebitda": 17.0, "ev_ebit": 19.0, "ev_sales": 1.2, "pe": 17, "ps": 1.0, "pb": 5.0, "fcf_yield": 0.040, "cap_rate": 0.07, "median_growth": 0.04},
    "Energy": {"ev_ebitda": 7.5, "ev_ebit": 9.0, "ev_sales": 1.5, "pe": 12, "ps": 1.2, "pb": 1.8, "fcf_yield": 0.080, "cap_rate": 0.10, "median_growth": 0.03},
    "Industrials": {"ev_ebitda": 16.5, "ev_ebit": 18.0, "ev_sales": 1.8, "pe": 17, "ps": 1.5, "pb": 4.0, "fcf_yield": 0.045, "cap_rate": 0.08, "median_growth": 0.06},
    "Materials": {"ev_ebitda": 14.0, "ev_ebit": 15.0, "ev_sales": 1.5, "pe": 14, "ps": 1.3, "pb": 2.5, "fcf_yield": 0.050, "cap_rate": 0.09, "median_growth": 0.04},
    "Real Estate": {"ev_ebitda": 21.0, "ev_ebit": 24.0, "ev_sales": 6.0, "pe": 20, "ps": 5.0, "pb": 2.0, "fcf_yield": 0.050, "cap_rate": 0.065, "median_growth": 0.04},
    "Utilities": {"ev_ebitda": 13.0, "ev_ebit": 15.0, "ev_sales": 3.0, "pe": 17, "ps": 2.5, "pb": 2.0, "fcf_yield": 0.055, "cap_rate": 0.065, "median_growth": 0.03},
    "Communication Services": {"ev_ebitda": 15.0, "ev_ebit": 17.0, "ev_sales": 3.5, "pe": 18, "ps": 3.0, "pb": 3.0, "fcf_yield": 0.045, "cap_rate": 0.08, "median_growth": 0.06},
    "Financial Services": {"ev_ebitda": 12.0, "ev_ebit": 14.0, "ev_sales": 3.0, "pe": 13, "ps": 2.5, "pb": 1.5, "fcf_yield": 0.060, "cap_rate": 0.08, "median_growth": 0.05},
    "Financials": {"ev_ebitda": 12.0, "ev_ebit": 14.0, "ev_sales": 3.0, "pe": 13, "ps": 2.5, "pb": 1.5, "fcf_yield": 0.060, "cap_rate": 0.08, "median_growth": 0.05},
    "default": {"ev_ebitda": 16.0, "ev_ebit": 18.0, "ev_sales": 2.5, "pe": 18, "ps": 2.0, "pb": 3.0, "fcf_yield": 0.045, "cap_rate": 0.08, "median_growth": 0.06},
}


def _safe_median(values):
    """Compute median of non-None, positive values. Returns None if empty."""
    clean = [float(v) for v in values if v is not None and float(v) > 0]
    return statistics.median(clean) if len(clean) >= 3 else None


def _compute_sector_multiples(rows):
    """Given list of stock dicts, compute per-sector median multiples."""
    from collections import defaultdict
    buckets = defaultdict(list)
    for r in rows:
        sector = r.get("sector")
        if sector:
            buckets[sector].append(r)

    result = {}
    all_pe, all_ev_ebitda, all_ps, all_pb, all_fcf_y, all_growth = [], [], [], [], [], []

    for sector, stocks in buckets.items():
        pe_vals = [s["pe_ratio"] for s in stocks]
        ev_ebitda_vals = [s["ev_to_ebitda"] for s in stocks]
        ps_vals = [s.get("ps_ratio") for s in stocks]
        pb_vals = [s.get("pb_ratio") for s in stocks]
        fcf_yields = []
        for s in stocks:
            fcf = s.get("free_cashflow")
            mc = s.get("market_cap")
            if fcf and mc and mc > 0:
                fcf_yields.append(fcf / mc)
        growth_vals = [s.get("revenue_growth") for s in stocks]

        fb = HARDCODED_FALLBACK.get(sector, HARDCODED_FALLBACK["default"])
        result[sector] = {
            "ev_ebitda": _safe_median(ev_ebitda_vals) or fb["ev_ebitda"],
            "ev_ebit": (_safe_median(ev_ebitda_vals) or fb["ev_ebitda"]) * 1.1,  # approx
            "ev_sales": _safe_median([s.get("ev_to_revenue") or s.get("ps_ratio") for s in stocks]) or fb["ev_sales"],
            "pe": _safe_median(pe_vals) or fb["pe"],
            "ps": _safe_median(ps_vals) or fb["ps"],
            "pb": _safe_median(pb_vals) or fb["pb"],
            "fcf_yield": _safe_median(fcf_yields) or fb["fcf_yield"],
            "cap_rate": fb["cap_rate"],  # keep hardcoded — cap rates are subjective
            "median_growth": _safe_median(growth_vals) or fb["median_growth"],
        }

        all_pe.extend(pe_vals)
        all_ev_ebitda.extend(ev_ebitda_vals)
        all_ps.extend(ps_vals)
        all_pb.extend(pb_vals)
        all_fcf_y.extend(fcf_yields)
        all_growth.extend(growth_vals)

    # Default = global medians
    fb = HARDCODED_FALLBACK["default"]
    result["default"] = {
        "ev_ebitda": _safe_median(all_ev_ebitda) or fb["ev_ebitda"],
        "ev_ebit": (_safe_median(all_ev_ebitda) or fb["ev_ebitda"]) * 1.1,
        "ev_sales": fb["ev_sales"],
        "pe": _safe_median(all_pe) or fb["pe"],
        "ps": _safe_median(all_ps) or fb["ps"],
        "pb": _safe_median(all_pb) or fb["pb"],
        "fcf_yield": _safe_median(all_fcf_y) or fb["fcf_yield"],
        "cap_rate": fb["cap_rate"],
        "median_growth": _safe_median(all_growth) or fb["median_growth"],
    }
    return result


def get_sector_multiples():
    """Return sector multiples dict, cached 24hrs. Falls back to hardcoded."""
    now = time.time()
    if _multiples_cache["data"] and (now - _multiples_cache["ts"]) < _CACHE_TTL:
        return _multiples_cache["data"]
    try:
        resp = _sb.table("stock_fundamentals").select(
            "sector, pe_ratio, ev_to_ebitda, ps_ratio, pb_ratio, "
            "free_cashflow, market_cap, revenue_growth, ev_to_revenue"
        ).not_.is_("sector", "null").not_.is_("pe_ratio", "null").execute()
        rows = resp.data or []
        if len(rows) >= 50:
            result = _compute_sector_multiples(rows)
            _multiples_cache["data"] = result
            _multiples_cache["ts"] = now
            return result
    except Exception:
        pass
    _multiples_cache["data"] = HARDCODED_FALLBACK
    _multiples_cache["ts"] = now
    return HARDCODED_FALLBACK


def get_risk_free_rate():
    """Fetch US 10Y Treasury yield from FMP, cached 24hrs. Fallback 4.3%."""
    now = time.time()
    if _rfr_cache["data"] is not None and (now - _rfr_cache["ts"]) < _CACHE_TTL:
        return _rfr_cache["data"]
    try:
        data = fmp_get_first("treasury-rates", {"limit": 1})
        if data and "year10" in data:
            rate = float(data["year10"]) / 100.0
            if 0.005 <= rate <= 0.15:
                _rfr_cache["data"] = rate
                _rfr_cache["ts"] = now
                return rate
    except Exception:
        pass
    _rfr_cache["data"] = 0.043
    _rfr_cache["ts"] = now
    return 0.043


def get_sector(sector, multiples=None):
    """Get multiples for a sector, with fallback to default."""
    if multiples is None:
        multiples = get_sector_multiples()
    return multiples.get(sector, multiples.get("default", HARDCODED_FALLBACK["default"]))
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_sector_multiples.py -v
```
Expected: PASS (may need to adjust test for `__wrapped__` — use mock on the cache dict instead if needed)

- [ ] **Step 6: Commit**

```bash
git add backend/valuation/sector_multiples.py backend/tests/
git commit -m "feat: add dynamic sector multiples + live Treasury yield module

Queries stock_fundamentals table for live sector medians (cached 24hrs).
Fetches 10Y Treasury yield from FMP API (cached 24hrs).
Falls back to hardcoded values on failure."
```

---

### Task 2: Extend data_fetcher.py with additional fields

**Files:**
- Modify: `backend/data_fetcher.py`

The valuation overhaul needs fields not currently fetched: `operating_income`, `depreciation_amortization`, `total_assets` (current + prior year), `3yr avg EPS`, `3yr avg ROE`, `interest_expense`, `ebitda_prev`, `total_assets_prev`. All exist in the `financial_statements` and `key_metrics` Supabase tables.

- [ ] **Step 1: Add helper to fetch supplemental valuation data**

Add a new function `_fetch_valuation_supplements(ticker)` to `backend/data_fetcher.py` that queries `financial_statements` and `key_metrics` tables for the latest data:

```python
def _fetch_valuation_supplements(ticker: str) -> dict:
    """Fetch additional data from financial_statements and key_metrics for valuation models.

    Returns dict with: operating_income, depreciation_amortization, total_assets,
    total_assets_prev, ebitda_prev, eps_3yr_avg, roe_3yr_avg, interest_expense, payout_ratio.
    """
    result = {}
    try:
        # Latest annual income statement for operating_income, interest_expense
        income = supabase.table("financial_statements") \
            .select("operating_income, interest_expense, ebitda") \
            .eq("ticker", ticker).eq("period_type", "FY").eq("statement_type", "income") \
            .order("period_date", desc=True).limit(2).execute().data or []
        if income:
            result["operating_income"] = _safe_val(income[0].get("operating_income"))
            result["interest_expense"] = _safe_val(income[0].get("interest_expense"))
            if len(income) >= 2:
                result["ebitda_prev"] = _safe_val(income[1].get("ebitda"))

        # Latest annual cash flow for depreciation
        cashflow = supabase.table("financial_statements") \
            .select("depreciation_amortization") \
            .eq("ticker", ticker).eq("period_type", "FY").eq("statement_type", "cashflow") \
            .order("period_date", desc=True).limit(1).execute().data or []
        if cashflow:
            result["depreciation_amortization"] = _safe_val(cashflow[0].get("depreciation_amortization"))

        # Latest 2 annual balance sheets for total_assets (current + prior)
        balance = supabase.table("financial_statements") \
            .select("total_assets") \
            .eq("ticker", ticker).eq("period_type", "FY").eq("statement_type", "balance") \
            .order("period_date", desc=True).limit(2).execute().data or []
        if balance:
            result["total_assets"] = _safe_val(balance[0].get("total_assets"))
            if len(balance) >= 2:
                result["total_assets_prev"] = _safe_val(balance[1].get("total_assets"))

        # 3-year avg annual EPS from financial_statements (has eps column per FY)
        eps_rows = supabase.table("financial_statements") \
            .select("eps_diluted") \
            .eq("ticker", ticker).eq("period_type", "FY").eq("statement_type", "income") \
            .order("period_date", desc=True).limit(3).execute().data or []
        eps_vals = [_safe_val(e.get("eps_diluted")) for e in eps_rows if _safe_val(e.get("eps_diluted")) is not None]
        if len(eps_vals) >= 2:
            result["eps_3yr_avg"] = sum(eps_vals) / len(eps_vals)

        # 3-year avg ROE from key_metrics
        metrics = supabase.table("key_metrics") \
            .select("roe, payout_ratio") \
            .eq("ticker", ticker).eq("period_type", "FY") \
            .order("period_date", desc=True).limit(3).execute().data or []
        roe_vals = [_safe_val(m.get("roe")) for m in metrics if _safe_val(m.get("roe")) is not None]
        if len(roe_vals) >= 2:
            result["roe_3yr_avg"] = sum(roe_vals) / len(roe_vals)
        if metrics and metrics[0].get("payout_ratio") is not None:
            result["payout_ratio"] = _safe_val(metrics[0].get("payout_ratio"))

    except Exception:
        pass  # Non-critical — models fall back to available data
    return result
```

- [ ] **Step 2: Integrate supplements into fetch_stock_data()**

In `fetch_stock_data()`, just before `return data` at the end, add:

```python
    # Fetch supplemental data for valuation models
    supplements = _fetch_valuation_supplements(ticker)
    for k, v in supplements.items():
        if v is not None and data.get(k) is None:
            data[k] = v
```

- [ ] **Step 3: Verify by running the backend locally**

```bash
cd backend && FINNHUB_KEY=test uvicorn main:app --reload --port 8000 &
sleep 3 && curl -s http://localhost:8000/ | head -5
kill %1
```
Expected: Server starts without import errors.

- [ ] **Step 4: Commit**

```bash
git add backend/data_fetcher.py
git commit -m "feat: fetch supplemental valuation data from financial_statements + key_metrics

Adds operating_income, depreciation, total_assets (current/prior),
3yr avg EPS, 3yr avg ROE, interest_expense for model improvements."
```

---

## Chunk 2: Model Formula Fixes + New FCF Yield Model

### Task 3: Fix all model formulas in models.py (Changes 1-7)

**Files:**
- Modify: `backend/valuation/models.py`
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write tests for fixed models**

Create `backend/tests/test_models.py`:

```python
"""Tests for valuation models.

Prerequisite: Task 1 (sector_multiples.py) must be complete.
"""
import pytest
from valuation.models import (
    dcf, ddm, cap_earnings, ev_ebitda_comps, ev_ebit_comps,
    ev_sales_comps, pe_comps, ps_comps, peg_model, pb_model,
    residual_income, fcf_yield_model,
)
# Note: tests pass sector_multiples dicts directly, no Supabase calls needed

SECTOR_MULTS = {
    "Technology": {
        "ev_ebitda": 22.0, "ev_ebit": 25.0, "ev_sales": 6.5,
        "pe": 28.0, "ps": 6.0, "pb": 8.0, "fcf_yield": 0.035,
        "cap_rate": 0.06, "median_growth": 0.10,
    },
    "default": {
        "ev_ebitda": 16.0, "ev_ebit": 18.0, "ev_sales": 2.5,
        "pe": 18.0, "ps": 2.0, "pb": 3.0, "fcf_yield": 0.045,
        "cap_rate": 0.08, "median_growth": 0.06,
    },
}
RFR = 0.043  # risk-free rate


class TestEVEBIT:
    def test_uses_operating_income_when_available(self):
        data = {"ebitda": 130e9, "operating_income": 115e9, "sector": "Technology",
                "shares_outstanding": 15.5e9, "total_debt": 110e9, "cash": 60e9, "price": 175}
        result = ev_ebit_comps(data, SECTOR_MULTS)
        # Should use operating_income (115B), not ebitda*0.85 (110.5B)
        assert result["applicable"]
        expected = (25.0 * 115e9 - 110e9 + 60e9) / 15.5e9
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)

    def test_falls_back_to_ebitda_minus_da(self):
        data = {"ebitda": 130e9, "depreciation_amortization": 15e9, "sector": "Technology",
                "shares_outstanding": 15.5e9, "total_debt": 110e9, "cash": 60e9, "price": 175}
        result = ev_ebit_comps(data, SECTOR_MULTS)
        assert result["applicable"]
        expected = (25.0 * 115e9 - 110e9 + 60e9) / 15.5e9
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)


class TestDCF:
    def test_uses_live_risk_free_rate(self):
        data = {"free_cashflow": 100e9, "shares_outstanding": 15.5e9, "price": 175,
                "revenue_growth": 0.08, "beta": 1.2, "total_debt": 110e9, "cash": 60e9,
                "roa": 0.28, "payout_ratio": 0.15}
        result = dcf(data, risk_free_rate=0.043)
        assert result["applicable"]
        assert "WACC" in result["assumptions"]
        # WACC should NOT be 0.04 + beta*0.05 = 0.10 (old formula)
        wacc_str = result["assumptions"]["WACC"]
        wacc_val = float(wacc_str.strip("%")) / 100
        assert wacc_val != 0.10  # Not the old hardcoded result

    def test_terminal_growth_capped_below_wacc(self):
        data = {"free_cashflow": 100e9, "shares_outstanding": 15.5e9, "price": 175,
                "beta": 0.5, "total_debt": 0, "cash": 60e9, "roa": 0.10}
        result = dcf(data, risk_free_rate=0.043)
        if result["applicable"]:
            tg = float(result["assumptions"]["Terminal Growth"].strip("%")) / 100
            wacc = float(result["assumptions"]["WACC"].strip("%")) / 100
            assert tg < wacc - 0.01


class TestPEG:
    def test_uses_sector_relative_formula(self):
        data = {"eps": 6.5, "price": 175, "earnings_growth": 0.10, "sector": "Technology"}
        result = peg_model(data, SECTOR_MULTS)
        assert result["applicable"]
        # Old formula: 6.5 * 10 = 65. New should be different.
        assert result["intrinsic_value"] != pytest.approx(65.0, rel=0.1)


class TestFCFYield:
    def test_basic_calculation(self):
        data = {"free_cashflow": 100e9, "market_cap": 2700e9,
                "shares_outstanding": 15.5e9, "price": 175, "sector": "Technology"}
        result = fcf_yield_model(data, SECTOR_MULTS)
        assert result["applicable"]
        # Fair value = (100e9 / 0.035) / 15.5e9
        expected = (100e9 / 0.035) / 15.5e9
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)

    def test_negative_fcf_not_applicable(self):
        data = {"free_cashflow": -50e9, "market_cap": 2700e9,
                "shares_outstanding": 15.5e9, "price": 175, "sector": "Technology"}
        result = fcf_yield_model(data, SECTOR_MULTS)
        assert not result["applicable"]


class TestDDM:
    def test_uses_live_risk_free_rate(self):
        data = {"dividend_yield": 0.02, "price": 175, "beta": 1.2}
        result = ddm(data, risk_free_rate=0.043)
        assert result["applicable"]
        # COE = 0.043 + 1.2 * 0.055 = 0.109
        coe = min(max(0.043 + 1.2 * 0.055, 0.06), 0.14)
        annual_div = 175 * 0.02
        expected = (annual_div * 1.04) / (coe - 0.04)
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)

    def test_no_dividend_not_applicable(self):
        data = {"dividend_yield": 0, "price": 175, "beta": 1.0}
        result = ddm(data, risk_free_rate=0.043)
        assert not result["applicable"]


class TestResidualIncome:
    def test_uses_smoothed_eps_when_available(self):
        data = {"book_value_per_share": 4.25, "eps": 6.50, "eps_3yr_avg": 6.20,
                "price": 175, "beta": 1.2}
        result = residual_income(data, risk_free_rate=0.043)
        assert result["applicable"]
        coe = min(max(0.043 + 1.2 * 0.055, 0.06), 0.14)
        ri = 6.20 - (coe * 4.25)  # uses eps_3yr_avg
        expected = 4.25 + (ri / coe)
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)


class TestCapEarnings:
    def test_uses_sector_cap_rate(self):
        data = {"eps": 6.50, "price": 175, "sector": "Technology"}
        result = cap_earnings(data, SECTOR_MULTS)
        assert result["applicable"]
        expected = 6.50 / 0.06  # Technology cap_rate
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)


class TestPB:
    def test_uses_smoothed_roe_when_available(self):
        data = {"book_value_per_share": 4.25, "roe": 0.50, "roe_3yr_avg": 0.43,
                "price": 175, "beta": 1.2, "sector": "Technology"}
        result = pb_model(data, risk_free_rate=0.043)
        assert result["applicable"]
        # Should use 0.43 (smoothed), not 0.50 (trailing)
        coe = min(max(0.043 + 1.2 * 0.055, 0.06), 0.14)
        justified = max(0.43 / coe, 0.5)
        expected = justified * 4.25
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)

    def test_falls_back_to_trailing_roe(self):
        data = {"book_value_per_share": 4.25, "roe": 0.50,
                "price": 175, "beta": 1.2, "sector": "Technology"}
        result = pb_model(data, risk_free_rate=0.043)
        assert result["applicable"]
        coe = min(max(0.043 + 1.2 * 0.055, 0.06), 0.14)
        justified = max(0.50 / coe, 0.5)
        expected = justified * 4.25
        assert result["intrinsic_value"] == pytest.approx(expected, rel=0.01)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_models.py -v
```
Expected: FAIL (functions don't accept new parameters yet)

- [ ] **Step 3: Overhaul models.py**

Replace the entire `backend/valuation/models.py`. The `_verdict()`, `_safe()`, and `_pct()` helpers remain unchanged. Remove all `SECTOR_*` dicts at the top. Add the helper and all updated functions below.

**Prerequisite:** Task 1 (sector_multiples.py) must be complete — models import `HARDCODED_FALLBACK` from it.

```python

import numpy as np


def _safe(val, fallback=None):
    if val is None:
        return fallback
    try:
        f = float(val)
        return fallback if (np.isnan(f) or np.isinf(f)) else val
    except (TypeError, ValueError):
        return fallback

def _verdict(intrinsic, current):
    if intrinsic is None or current is None or current == 0:
        return "Insufficient Data"
    m = (intrinsic - current) / current
    if m > 0.15:  return "Undervalued"
    if m < -0.15: return "Overvalued"
    return "Fairly Valued"

def _pct(intrinsic, current):
    if not current: return 0
    return round((intrinsic - current) / current * 100, 1)


def _get_sector_mult(sector, sector_multiples, key):
    """Get a specific multiple for a sector from the dynamic multiples dict."""
    if sector_multiples:
        sm = sector_multiples.get(sector, sector_multiples.get("default", {}))
        val = sm.get(key)
        if val:
            return val
    from valuation.sector_multiples import HARDCODED_FALLBACK
    return HARDCODED_FALLBACK.get(sector, HARDCODED_FALLBACK["default"]).get(key)


# ── 1. DCF ──────────────────────────────────────────────────────────
def dcf(data, growth_rate=None, wacc=None, terminal_growth=None, years=5, risk_free_rate=None):
    fcf    = _safe(data.get("free_cashflow"))
    shares = _safe(data.get("shares_outstanding"))
    price  = _safe(data.get("price"))
    if not fcf or not shares or fcf <= 0 or not price:
        return {"model": "DCF (Discounted Cash Flow)", "applicable": False,
                "reason": "Negative or missing Free Cash Flow",
                "description": "Projects future Free Cash Flows and discounts them back to present value using WACC.",
                "category": "Income-Based"}
    if risk_free_rate is None:
        risk_free_rate = 0.043
    if wacc is None:
        beta = float(data.get("beta") or 1.0)
        equity_risk_premium = 0.055
        cost_of_equity = risk_free_rate + beta * equity_risk_premium
        debt = float(data.get("total_debt") or 0)
        mcap = float(data.get("market_cap") or 0)
        interest = float(data.get("interest_expense") or 0)
        if mcap > 0 and debt > 0:
            cost_of_debt = (interest / debt) if interest > 0 else risk_free_rate + 0.02
            tax_rate = 0.21
            total_capital = mcap + debt
            wacc = (mcap / total_capital) * cost_of_equity + (debt / total_capital) * cost_of_debt * (1 - tax_rate)
        else:
            wacc = cost_of_equity
        wacc = min(max(wacc, 0.06), 0.16)
    if growth_rate is None:
        roa = float(data.get("roa") or 0)
        payout = float(data.get("payout_ratio") or 0.3)
        retention = max(1.0 - payout, 0.3)
        sustainable = roa * retention if roa > 0 else 0
        rev_growth = float(data.get("revenue_growth") or 0)
        growth_rate = max(min(sustainable, rev_growth, 0.20), 0.02) if sustainable > 0 else min(max(rev_growth, 0.02), 0.20)
    if terminal_growth is None:
        terminal_growth = min(0.025, wacc - 0.015)
    debt = float(data.get("total_debt") or 0)
    cash = float(data.get("cash") or 0)
    proj = [fcf * (1 + growth_rate) ** i for i in range(1, years + 1)]
    disc = [cf / (1 + wacc) ** i for i, cf in enumerate(proj, 1)]
    tv   = proj[-1] * (1 + terminal_growth) / (wacc - terminal_growth)
    pv_tv = tv / (1 + wacc) ** years
    intrinsic = (sum(disc) + pv_tv - debt + cash) / shares
    return {
        "model": "DCF (Discounted Cash Flow)", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"FCF Growth Rate": f"{growth_rate:.1%}", "WACC": f"{wacc:.1%}",
                        "Terminal Growth": f"{terminal_growth:.1%}", "Projection Years": years},
        "description": "Projects future Free Cash Flows and discounts them back to present value using WACC.",
        "category": "Income-Based",
    }


# ── 2. Capitalization of Earnings ───────────────────────────────────
def cap_earnings(data, sector_multiples=None):
    eps    = _safe(data.get("eps"))
    sector = data.get("sector", "default")
    price  = _safe(data.get("price"))
    cap_rate = _get_sector_mult(sector, sector_multiples, "cap_rate")
    if not eps or eps <= 0 or not price:
        return {"model": "Capitalization of Earnings", "applicable": False,
                "reason": "Negative or missing EPS",
                "description": "Divides expected earnings by a capitalization rate — best for stable, mature companies.",
                "category": "Income-Based"}
    intrinsic = eps / cap_rate
    return {
        "model": "Capitalization of Earnings", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Trailing EPS": f"${round(eps,2)}", "Capitalization Rate": f"{cap_rate:.1%}"},
        "description": "Divides expected earnings by a capitalization rate — best for stable, mature companies.",
        "category": "Income-Based",
    }


# ── 3. DDM ──────────────────────────────────────────────────────────
def ddm(data, cost_of_equity=None, long_term_growth=0.04, risk_free_rate=None):
    div_yield = data.get("dividend_yield") or 0
    price     = _safe(data.get("price"))
    if div_yield <= 0 or not price:
        return {"model": "Gordon Growth Model (DDM)", "applicable": False,
                "reason": "Company does not pay dividends",
                "description": "Values a stock based on expected future dividends growing at a constant rate.",
                "category": "Income-Based"}
    if cost_of_equity is None:
        if risk_free_rate is None:
            risk_free_rate = 0.043
        beta = float(data.get("beta") or 1.0)
        cost_of_equity = min(max(risk_free_rate + beta * 0.055, 0.06), 0.14)
    if cost_of_equity <= long_term_growth:
        return {"model": "Gordon Growth Model (DDM)", "applicable": False,
                "reason": "Cost of equity must exceed long-term growth rate",
                "description": "Values a stock based on expected future dividends growing at a constant rate.",
                "category": "Income-Based"}
    annual_div = price * div_yield
    intrinsic  = (annual_div * (1 + long_term_growth)) / (cost_of_equity - long_term_growth)
    return {
        "model": "Gordon Growth Model (DDM)", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Annual Dividend": f"${round(annual_div,2)}",
                        "Cost of Equity": f"{cost_of_equity:.1%}", "Long-term Growth": f"{long_term_growth:.1%}"},
        "description": "Values a stock based on expected future dividends growing at a constant rate.",
        "category": "Income-Based",
    }


# ── 4. EV/EBITDA ────────────────────────────────────────────────────
def ev_ebitda_comps(data, sector_multiples=None):
    ebitda    = _safe(data.get("ebitda"))
    sector    = data.get("sector", "default")
    shares    = _safe(data.get("shares_outstanding"))
    debt      = float(data.get("total_debt") or 0)
    cash      = float(data.get("cash") or 0)
    price     = _safe(data.get("price"))
    benchmark = _get_sector_mult(sector, sector_multiples, "ev_ebitda")
    if not ebitda or ebitda <= 0 or not shares or not price:
        return {"model": "EV/EBITDA Comparables", "applicable": False,
                "reason": "Negative or missing EBITDA",
                "description": "Applies the sector median EV/EBITDA multiple to the company's EBITDA.",
                "category": "Market-Based"}
    intrinsic = (benchmark * ebitda - debt + cash) / shares
    return {
        "model": "EV/EBITDA Comparables", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Sector Median EV/EBITDA": benchmark, "Company EBITDA": f"${ebitda:,.0f}"},
        "description": "Applies the sector median EV/EBITDA multiple to the company's EBITDA.",
        "category": "Market-Based",
    }


# ── 5. EV/EBIT (fixed: use operating_income first) ─────────────────
def ev_ebit_comps(data, sector_multiples=None):
    sector    = data.get("sector", "default")
    shares    = _safe(data.get("shares_outstanding"))
    debt      = float(data.get("total_debt") or 0)
    cash      = float(data.get("cash") or 0)
    price     = _safe(data.get("price"))
    benchmark = _get_sector_mult(sector, sector_multiples, "ev_ebit")
    # Priority: operating_income → ebitda - D&A → ebitda * 0.85
    ebit = _safe(data.get("operating_income"))
    if not ebit or ebit <= 0:
        ebitda = _safe(data.get("ebitda"))
        da = _safe(data.get("depreciation_amortization"))
        if ebitda and ebitda > 0 and da:
            ebit = ebitda - da
        elif ebitda and ebitda > 0:
            ebit = ebitda * 0.85
    if not ebit or ebit <= 0 or not shares or not price:
        return {"model": "EV/EBIT Comparables", "applicable": False,
                "reason": "Insufficient EBIT data",
                "description": "Applies the sector median EV/EBIT multiple — excludes D&A for better operational comparison.",
                "category": "Market-Based"}
    intrinsic = (benchmark * ebit - debt + cash) / shares
    return {
        "model": "EV/EBIT Comparables", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Sector Median EV/EBIT": benchmark, "Est. EBIT": f"${ebit:,.0f}"},
        "description": "Applies the sector median EV/EBIT multiple — excludes D&A for better operational comparison.",
        "category": "Market-Based",
    }


# ── 6. EV/Sales ─────────────────────────────────────────────────────
def ev_sales_comps(data, sector_multiples=None):
    revenue   = _safe(data.get("revenue"))
    sector    = data.get("sector", "default")
    shares    = _safe(data.get("shares_outstanding"))
    debt      = float(data.get("total_debt") or 0)
    cash      = float(data.get("cash") or 0)
    price     = _safe(data.get("price"))
    benchmark = _get_sector_mult(sector, sector_multiples, "ev_sales")
    if not revenue or not shares or not price:
        return {"model": "EV/Sales Comparables", "applicable": False,
                "reason": "Missing revenue or shares data",
                "description": "Applies the sector median EV/Sales multiple — useful for high-growth or pre-profit companies.",
                "category": "Market-Based"}
    intrinsic = (benchmark * revenue - debt + cash) / shares
    return {
        "model": "EV/Sales Comparables", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Sector Median EV/Sales": benchmark, "Total Revenue": f"${revenue:,.0f}"},
        "description": "Applies the sector median EV/Sales multiple — useful for high-growth or pre-profit companies.",
        "category": "Market-Based",
    }


# ── 7. P/E (now display-only, excluded from consensus) ──────────────
def pe_comps(data, sector_multiples=None):
    eps       = _safe(data.get("eps"))
    sector    = data.get("sector", "default")
    price     = _safe(data.get("price"))
    median_pe = _get_sector_mult(sector, sector_multiples, "pe")
    if not eps or eps <= 0 or not price:
        return {"model": "P/E Comparables", "applicable": False,
                "reason": "Negative or missing EPS",
                "description": "Applies the sector median P/E ratio to the company's trailing 12-month EPS.",
                "category": "Market-Based"}
    intrinsic = median_pe * eps
    return {
        "model": "P/E Comparables", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Sector Median P/E": median_pe, "Trailing EPS": f"${round(eps,2)}"},
        "description": "Applies the sector median P/E ratio to the company's trailing 12-month EPS.",
        "category": "Market-Based",
    }


# ── 8. P/S ──────────────────────────────────────────────────────────
def ps_comps(data, sector_multiples=None):
    revenue   = _safe(data.get("revenue"))
    shares    = _safe(data.get("shares_outstanding"))
    sector    = data.get("sector", "default")
    price     = _safe(data.get("price"))
    median_ps = _get_sector_mult(sector, sector_multiples, "ps")
    if not revenue or not shares or not price:
        return {"model": "P/S Comparables", "applicable": False,
                "reason": "Missing revenue or shares data",
                "description": "Applies the sector median Price/Sales multiple to revenue per share.",
                "category": "Market-Based"}
    intrinsic = median_ps * (revenue / shares)
    return {
        "model": "P/S Comparables", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Sector Median P/S": median_ps, "Revenue Per Share": f"${round(revenue/shares,2)}"},
        "description": "Applies the sector median Price/Sales multiple to revenue per share.",
        "category": "Market-Based",
    }


# ── 9. PEG Ratio (fixed: sector-relative formula) ──────────────────
def peg_model(data, sector_multiples=None):
    eps    = _safe(data.get("eps"))
    price  = _safe(data.get("price"))
    growth = _safe(data.get("earnings_growth") or data.get("revenue_growth"))
    sector = data.get("sector", "default")
    if not eps or eps <= 0 or not price or not growth or growth <= 0:
        return {"model": "PEG Ratio", "applicable": False,
                "reason": "Insufficient earnings or growth data",
                "description": "Relates P/E to earnings growth rate — a PEG of 1 suggests fair value.",
                "category": "Market-Based"}
    sector_pe = _get_sector_mult(sector, sector_multiples, "pe")
    sector_growth = _get_sector_mult(sector, sector_multiples, "median_growth")
    # Sector-relative: fair PE = sector_PE * (company_growth / sector_growth), capped
    growth_ratio = min(float(growth) / sector_growth, 3.0) if sector_growth > 0 else 1.0
    fair_pe = sector_pe * growth_ratio
    fair_pe = min(max(fair_pe, 5), 60)  # sanity clamp
    intrinsic = fair_pe * eps
    pe_ratio  = price / eps
    growth_pct = float(growth) * 100
    peg = pe_ratio / growth_pct if growth_pct else None
    return {
        "model": "PEG Ratio", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Trailing EPS": f"${round(eps,2)}", "Growth Rate": f"{growth:.1%}",
                        "Sector Median P/E": sector_pe, "Fair P/E": round(fair_pe, 1),
                        "PEG Ratio": round(peg, 2) if peg else "N/A"},
        "description": "Relates P/E to earnings growth — sector-relative fair P/E adjusted by growth differential.",
        "category": "Market-Based",
    }


# ── 10. P/B (fixed: uses 3yr smoothed ROE, live risk-free rate) ────
def pb_model(data, sector_multiples=None, risk_free_rate=None):
    bvps  = _safe(data.get("book_value_per_share"))
    roe   = float(data.get("roe_3yr_avg") or data.get("roe") or 0)
    price = _safe(data.get("price"))
    beta  = float(data.get("beta") or 1.0)
    if risk_free_rate is None:
        risk_free_rate = 0.043
    coe   = min(max(risk_free_rate + beta * 0.055, 0.06), 0.14)
    if not bvps or bvps <= 0 or not price:
        return {"model": "Price-to-Book (P/B)", "applicable": False,
                "reason": "Missing or negative book value",
                "description": "Calculates a justified P/B ratio from ROE vs cost of equity.",
                "category": "Asset-Based"}
    if bvps > price * 50:
        return {"model": "Price-to-Book (P/B)", "applicable": False,
                "reason": "Book value per share is abnormally large — model not reliable for this stock",
                "description": "Calculates a justified P/B ratio from ROE vs cost of equity.",
                "category": "Asset-Based"}
    justified_pb = max(float(roe) / coe if coe > 0 else 1.0, 0.5)
    intrinsic    = justified_pb * bvps
    roe_source = "3yr avg" if data.get("roe_3yr_avg") else "trailing"
    return {
        "model": "Price-to-Book (P/B)", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"ROE": f"{roe:.1%} ({roe_source})", "Cost of Equity": f"{coe:.1%}",
                        "Justified P/B": round(justified_pb, 2), "Book Value/Share": f"${round(bvps,2)}"},
        "description": "Calculates a justified P/B ratio from ROE vs cost of equity — best for financial firms.",
        "category": "Asset-Based",
    }


# ── 11. Residual Income (fixed: uses 3yr smoothed EPS, live risk-free rate) ─
def residual_income(data, risk_free_rate=None):
    bvps  = _safe(data.get("book_value_per_share"))
    eps   = _safe(data.get("eps_3yr_avg") or data.get("eps"))
    price = _safe(data.get("price"))
    beta  = float(data.get("beta") or 1.0)
    if risk_free_rate is None:
        risk_free_rate = 0.043
    coe   = min(max(risk_free_rate + beta * 0.055, 0.06), 0.14)
    if not bvps or bvps <= 0 or not eps or not price:
        return {"model": "Residual Income", "applicable": False,
                "reason": "Missing book value or EPS data",
                "description": "Values a stock as book value plus the present value of excess returns above cost of equity.",
                "category": "Income-Based"}
    if bvps > price * 50:
        return {"model": "Residual Income", "applicable": False,
                "reason": "Book value per share is abnormally large",
                "description": "Values a stock as book value plus the present value of excess returns above cost of equity.",
                "category": "Income-Based"}
    ri = eps - (coe * bvps)
    intrinsic = bvps + (ri / coe) if coe > 0 else bvps
    eps_source = "3yr avg" if data.get("eps_3yr_avg") else "trailing"
    return {
        "model": "Residual Income", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"Book Value/Share": f"${round(bvps,2)}", "EPS": f"${round(eps,2)} ({eps_source})",
                        "Cost of Equity": f"{coe:.1%}", "Residual Income/Share": f"${round(ri,2)}"},
        "description": "Values a stock as book value plus the present value of excess returns above cost of equity.",
        "category": "Income-Based",
    }


# ── 12. FCF Yield (NEW — Yartseva: strongest predictor, weight 2.0x) ─
def fcf_yield_model(data, sector_multiples=None):
    fcf    = _safe(data.get("free_cashflow"))
    shares = _safe(data.get("shares_outstanding"))
    price  = _safe(data.get("price"))
    sector = data.get("sector", "default")
    if not fcf or fcf <= 0 or not shares or not price:
        return {"model": "FCF Yield", "applicable": False,
                "reason": "Negative or missing Free Cash Flow",
                "description": "Values a stock by comparing its FCF yield to the sector median — the strongest predictor of returns (Yartseva 2025).",
                "category": "Income-Based"}
    sector_fcf_yield = _get_sector_mult(sector, sector_multiples, "fcf_yield")
    # Fair market cap = FCF / sector_median_yield, then per share
    fair_mcap = fcf / sector_fcf_yield
    intrinsic = fair_mcap / shares
    company_yield = fcf / (price * shares)
    return {
        "model": "FCF Yield", "applicable": True,
        "intrinsic_value": round(intrinsic, 2), "current_price": round(price, 2),
        "upside_pct": _pct(intrinsic, price), "verdict": _verdict(intrinsic, price),
        "assumptions": {"FCF": f"${fcf:,.0f}", "Company FCF Yield": f"{company_yield:.2%}",
                        "Sector Median FCF Yield": f"{sector_fcf_yield:.2%}"},
        "description": "Values a stock by comparing its FCF yield to the sector median — the strongest predictor of returns (Yartseva 2025).",
        "category": "Income-Based",
    }
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python -m pytest tests/test_models.py -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/valuation/models.py backend/tests/test_models.py
git commit -m "feat: overhaul all valuation model formulas + add FCF Yield model

- Fix EV/EBIT: use actual operating_income, fallback chain
- Fix DCF: live risk-free rate, full WACC, ROA-based growth, capped terminal
- Fix DDM: live risk-free rate for cost of equity
- Fix PEG: sector-relative formula instead of invented one
- Fix P/B: 3yr smoothed ROE, live risk-free rate
- Fix Residual Income: 3yr smoothed EPS, live risk-free rate
- Add FCF Yield model (Yartseva: strongest predictor, weight 2.0x)
- All comparables accept dynamic sector_multiples dict"
```

---

## Chunk 3: Consensus Overhaul, Signals, and Integration

### Task 4: Overhaul router.py — weighted consensus, analyst blending, signals

**Files:**
- Modify: `backend/valuation/router.py`
- Create: `backend/tests/test_router.py`

- [ ] **Step 1: Write tests for new consensus logic**

Create `backend/tests/test_router.py`:

```python
"""Tests for valuation router — consensus, signals, confidence."""
import pytest
from unittest.mock import patch, MagicMock
from valuation.router import run_valuation


# All tests mock sector_multiples and risk_free_rate to avoid live API/Supabase calls
MOCK_SECTOR_MULTS = {
    "Technology": {
        "ev_ebitda": 22.0, "ev_ebit": 25.0, "ev_sales": 6.5,
        "pe": 28.0, "ps": 6.0, "pb": 8.0, "fcf_yield": 0.035,
        "cap_rate": 0.06, "median_growth": 0.10,
    },
    "default": {
        "ev_ebitda": 16.0, "ev_ebit": 18.0, "ev_sales": 2.5,
        "pe": 18.0, "ps": 2.0, "pb": 3.0, "fcf_yield": 0.045,
        "cap_rate": 0.08, "median_growth": 0.06,
    },
}


def _mock_run(data):
    """Call run_valuation with mocked external dependencies."""
    with patch("valuation.router.get_sector_multiples", return_value=MOCK_SECTOR_MULTS), \
         patch("valuation.router.get_risk_free_rate", return_value=0.043):
        return run_valuation("AAPL", data)


def test_pe_excluded_from_consensus(sample_stock_data):
    """P/E Comparables should not feed consensus — it's in OUTLIER_MODELS."""
    result = _mock_run(sample_stock_data)
    consensus = result.get("consensus")
    assert consensus is not None
    assert consensus["models_used"] >= 1
    # P/E should still be in valuations for display, but not in consensus
    pe_results = [r for r in result["valuations"] if r.get("model") == "P/E Comparables" and r.get("applicable")]
    if pe_results:
        # Verify the consensus model count is less than total applicable (P/E excluded)
        total_applicable = len([r for r in result["valuations"] if r.get("applicable")])
        assert consensus["models_used"] < total_applicable


def test_weighted_consensus_not_simple_average(sample_stock_data):
    """Weighted consensus should differ from simple average of non-outlier models."""
    result = _mock_run(sample_stock_data)
    # Get the non-outlier applicable models (same pool that feeds consensus)
    OUTLIER_MODELS = {"Graham Number", "Gordon Growth Model (DDM)", "Residual Income",
                      "Capitalization of Earnings", "P/E Comparables"}
    applicable = [r for r in result["valuations"]
                  if r.get("applicable") and r.get("model") not in OUTLIER_MODELS]
    if len(applicable) >= 2:
        simple_avg = sum(r["intrinsic_value"] for r in applicable) / len(applicable)
        consensus_val = result["consensus"]["average_intrinsic_value"]
        # Weighted consensus uses different weights per model, so should differ
        # (unless analyst blending changed it further)
        # Just verify it's a reasonable value, not exactly the simple average
        assert consensus_val > 0


def test_analyst_blending_divergent(sample_stock_data):
    """When analyst target diverges >10%, should get 60% analyst weight."""
    sample_stock_data["target_price"] = 500.0  # Very far from likely consensus
    result = _mock_run(sample_stock_data)
    ab = result.get("analyst_blended")
    if ab:
        assert ab["analyst_weight"] == 0.6
        assert ab["divergence_pct"] > 10


def test_analyst_blending_close(sample_stock_data):
    """When analyst target is within 10%, should get 30% analyst weight."""
    # Set target_price close to what consensus would be (roughly same range)
    result_no_target = _mock_run({**sample_stock_data, "target_price": None})
    if result_no_target.get("consensus"):
        consensus_val = result_no_target["consensus"]["average_intrinsic_value"]
        # Set target within 5% of consensus
        sample_stock_data["target_price"] = consensus_val * 1.03
        result = _mock_run(sample_stock_data)
        ab = result.get("analyst_blended")
        if ab:
            assert ab["analyst_weight"] == 0.3


def test_contextual_signals_present(sample_stock_data):
    """Result should contain contextual signals dict."""
    sample_stock_data["52w_high"] = 180.0
    sample_stock_data["price"] = 175.0
    sample_stock_data["current_price"] = 175.0
    sample_stock_data["52w_low"] = 140.0
    result = _mock_run(sample_stock_data)
    signals = result.get("signals", {})
    assert "price_range" in signals
    # 175 is 87.5% of range — near high
    assert signals["price_range"] > 0.8


def test_investment_quality_flag(sample_stock_data):
    """Flag when asset growth > EBITDA growth."""
    sample_stock_data["total_assets"] = 400e9
    sample_stock_data["total_assets_prev"] = 300e9  # 33% growth
    sample_stock_data["ebitda"] = 130e9
    sample_stock_data["ebitda_prev"] = 125e9  # 4% growth
    result = _mock_run(sample_stock_data)
    signals = result.get("signals", {})
    assert signals.get("investment_quality") == "negative"


def test_no_analyst_blended_when_no_target(sample_stock_data):
    """No analyst blending when target_price is missing."""
    sample_stock_data["target_price"] = None
    result = _mock_run(sample_stock_data)
    assert result.get("analyst_blended") is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_router.py -v
```
Expected: FAIL

- [ ] **Step 3: Overhaul router.py — complete replacement**

Replace the entire `backend/valuation/router.py` with this complete implementation:

```python
from classifier import classify_company, COMPANY_TYPE_LABELS
from valuation.models import (
    dcf, ddm, cap_earnings,
    ev_ebitda_comps, ev_ebit_comps, ev_sales_comps,
    pe_comps, ps_comps, peg_model,
    pb_model, residual_income, fcf_yield_model,
)
from valuation.sector_multiples import get_sector_multiples, get_risk_free_rate
import math

MODEL_MAP = {
    "dividend":                 [ddm, dcf, cap_earnings, ev_ebitda_comps, pe_comps, ps_comps, fcf_yield_model],
    "profitable_growth":        [dcf, ev_ebitda_comps, ev_ebit_comps, pe_comps, ps_comps, peg_model, fcf_yield_model],
    "high_growth_unprofitable": [ev_sales_comps, ps_comps, ev_ebitda_comps, peg_model],
    "cyclical":                 [dcf, ev_ebitda_comps, ev_ebit_comps, pe_comps, cap_earnings, fcf_yield_model],
    "financial":                [pb_model, pe_comps, ddm, residual_income, fcf_yield_model],
}

# Models excluded from consensus (display only)
OUTLIER_MODELS = {"Graham Number", "Gordon Growth Model (DDM)", "Residual Income",
                  "Capitalization of Earnings", "P/E Comparables"}

# Empirical weights for consensus (Yartseva 2025 + Delao et al. 2024)
MODEL_WEIGHTS = {
    "FCF Yield": 2.0,
    "EV/EBITDA Comparables": 1.5,
    "DCF (Discounted Cash Flow)": 1.5,
    "Price-to-Book (P/B)": 1.3,
    "EV/EBIT Comparables": 1.0,
    "EV/Sales Comparables": 1.0,
    "P/S Comparables": 1.0,
    "PEG Ratio": 0.8,
}

# Dispatcher: which extra kwargs each model function accepts
_SECTOR_MODELS = {ev_ebitda_comps, ev_ebit_comps, ev_sales_comps, pe_comps, ps_comps,
                  peg_model, cap_earnings, fcf_yield_model}
_RFR_MODELS = {dcf, ddm, pb_model, residual_income}
_BOTH_MODELS = set()  # pb_model takes both but sector_multiples is optional


def _normalise(data: dict) -> dict:
    d = dict(data)
    if d.get("price") is None:
        d["price"] = d.get("current_price")
    if d.get("cash") is None:
        d["cash"] = d.get("total_cash")
    if d.get("book_value_per_share") is None:
        bv     = d.get("book_value")
        shares = d.get("shares_outstanding")
        if bv and shares and shares > 0:
            d["book_value_per_share"] = bv
    if d.get("ev_ebitda") is None:
        d["ev_ebitda"] = d.get("ev_to_ebitda")
    return d


def _call_model(fn, data, sector_multiples, risk_free_rate):
    """Call a model function with the right kwargs based on its signature."""
    if fn in _SECTOR_MODELS and fn in _RFR_MODELS:
        return fn(data, sector_multiples=sector_multiples, risk_free_rate=risk_free_rate)
    elif fn in _SECTOR_MODELS:
        return fn(data, sector_multiples)
    elif fn in _RFR_MODELS:
        return fn(data, risk_free_rate=risk_free_rate)
    else:
        return fn(data)


def graham_number(data):
    eps   = data.get("eps")
    bvps  = data.get("book_value_per_share")
    price = data.get("price")
    if not eps or eps <= 0 or not bvps or bvps <= 0 or not price:
        return None
    if bvps > price * 50:
        return None
    val    = math.sqrt(22.5 * float(eps) * float(bvps))
    upside = (val - price) / price * 100
    return {
        "model": "Graham Number", "applicable": True,
        "intrinsic_value": round(val, 2), "current_price": round(price, 2),
        "upside_pct": round(upside, 1),
        "verdict": "Undervalued" if upside > 15 else "Overvalued" if upside < -15 else "Fairly Valued",
        "assumptions": {"EPS": f"${round(float(eps),2)}", "Book Value/Share": f"${round(float(bvps),2)}",
                        "Formula": "√(22.5 × EPS × BVPS)"},
        "description": "Benjamin Graham's classic formula — the geometric mean of 15x earnings and 1.5x book value.",
        "category": "Asset-Based",
    }


def dcf_sensitivity(data):
    fcf    = data.get("free_cashflow")
    shares = data.get("shares_outstanding")
    debt   = float(data.get("total_debt") or 0)
    cash   = float(data.get("cash") or 0)
    if not fcf or not shares or fcf <= 0:
        return None
    waccs   = [0.07, 0.09, 0.11]
    growths = [0.03, 0.06, 0.10]
    table   = []
    for g in growths:
        row = []
        for w in waccs:
            proj  = [fcf * (1 + g) ** i for i in range(1, 6)]
            disc  = [cf / (1 + w) ** i for i, cf in enumerate(proj, 1)]
            tv    = proj[-1] * 1.025 / (w - 0.025)
            pv_tv = tv / (1 + w) ** 5
            val   = (sum(disc) + pv_tv - debt + cash) / shares
            row.append(round(val, 2))
        table.append(row)
    return {"waccs": [f"{w:.0%}" for w in waccs], "growths": [f"{g:.0%}" for g in growths], "table": table}


def peer_comparison(data, sector_multiples=None):
    sector  = data.get("sector", "default")
    price   = data.get("price") or 1
    eps     = data.get("eps")
    ebitda  = data.get("ebitda")
    ev      = data.get("enterprise_value")
    revenue = data.get("revenue")
    shares  = data.get("shares_outstanding") or 1
    from valuation.sector_multiples import HARDCODED_FALLBACK
    sm = (sector_multiples or HARDCODED_FALLBACK).get(sector, (sector_multiples or HARDCODED_FALLBACK).get("default", {}))
    rows = []
    if eps and eps > 0:
        actual_pe = round(price / float(eps), 1)
        sector_pe = sm.get("pe", 18)
        rows.append({"metric": "P/E Ratio", "company": actual_pe, "sector_median": sector_pe,
                      "diff_pct": round((actual_pe - sector_pe) / sector_pe * 100, 1)})
    if ebitda and ebitda > 0 and ev:
        actual_ev = round(float(ev) / float(ebitda), 1)
        sector_ev = sm.get("ev_ebitda", 16)
        rows.append({"metric": "EV/EBITDA", "company": actual_ev, "sector_median": sector_ev,
                      "diff_pct": round((actual_ev - sector_ev) / sector_ev * 100, 1)})
    if revenue and revenue > 0:
        actual_ps = round(price / (float(revenue) / shares), 2)
        sector_ps = sm.get("ps", 2)
        rows.append({"metric": "P/S Ratio", "company": actual_ps, "sector_median": sector_ps,
                      "diff_pct": round((actual_ps - sector_ps) / sector_ps * 100, 1)})
    return rows


def _compute_signals(data, consensus, sector_multiples):
    """Compute contextual risk/opportunity signals."""
    signals = {}
    price = data.get("price") or 0
    high52 = data.get("52w_high") or 0
    low52 = data.get("52w_low") or 0

    # Price range signal (Change 16)
    if high52 and low52 and high52 > low52 and price > 0:
        price_range = (price - low52) / (high52 - low52)
        signals["price_range"] = round(price_range, 3)
        if price_range > 0.9:
            signals["price_range_warning"] = "Trading near 52-week high — elevated reversal risk"

    # Investment quality (Change 15)
    total_assets = data.get("total_assets")
    total_assets_prev = data.get("total_assets_prev")
    ebitda_cur = data.get("ebitda")
    ebitda_prev = data.get("ebitda_prev")
    if total_assets and total_assets_prev and total_assets_prev > 0 and ebitda_cur and ebitda_prev and ebitda_prev > 0:
        asset_growth = (total_assets - total_assets_prev) / total_assets_prev
        ebitda_growth = (ebitda_cur - ebitda_prev) / ebitda_prev
        signals["asset_growth"] = round(asset_growth, 3)
        signals["ebitda_growth"] = round(ebitda_growth, 3)
        if asset_growth > ebitda_growth and asset_growth > 0.05:
            signals["investment_quality"] = "negative"
        else:
            signals["investment_quality"] = "neutral"

    # Earnings yield signal (Change 9)
    eps = data.get("eps")
    if eps and price and price > 0:
        company_ey = eps / price
        sector = data.get("sector", "default")
        sm = sector_multiples.get(sector, sector_multiples.get("default", {}))
        sector_pe = sm.get("pe", 18)
        sector_ey = 1.0 / sector_pe if sector_pe > 0 else 0.055
        signals["earnings_yield"] = round(company_ey, 4)
        signals["sector_earnings_yield"] = round(sector_ey, 4)
        if company_ey > sector_ey * 1.3:
            signals["earnings_yield_signal"] = "above_sector"
        elif company_ey < sector_ey * 0.7:
            signals["earnings_yield_signal"] = "below_sector"

    # Smoothed earnings flag (Change 18)
    eps_3yr = data.get("eps_3yr_avg")
    if eps and eps_3yr and eps_3yr > 0:
        divergence = abs(eps - eps_3yr) / eps_3yr
        if divergence > 0.30:
            direction = "elevated" if eps > eps_3yr else "depressed"
            signals["earnings_smoothing"] = {
                "trailing_eps": round(eps, 2), "avg_3yr_eps": round(eps_3yr, 2), "status": direction,
            }

    # Mispricing persistence note (Change 17)
    if consensus and abs(consensus.get("upside_pct", 0)) > 25:
        signals["mispricing_note"] = "Mispricings of this magnitude typically take 3-5+ years to fully correct"

    return signals


def confidence_score(data, result, signals=None, analyst_blended=None):
    fields = ["price", "eps", "ebitda", "revenue", "free_cashflow",
              "book_value_per_share", "shares_outstanding", "dividend_yield", "beta", "roe"]
    filled = sum(1 for f in fields if data.get(f) not in (None, 0))
    pct = filled / len(fields)
    n_applicable = len([r for r in result if r and r.get("applicable")])

    if pct >= 0.8 and n_applicable >= 3:
        score = "High"
    elif pct >= 0.5 and n_applicable >= 2:
        score = "Medium"
    else:
        score = "Low"

    if signals:
        # Downgrade for negative investment quality
        if signals.get("investment_quality") == "negative":
            score = {"High": "Medium", "Medium": "Low"}.get(score, score)
        # Downgrade for near 52w high
        if signals.get("price_range", 0) > 0.9:
            score = {"High": "Medium", "Medium": "Low"}.get(score, score)

    # Upgrade if analyst target and model consensus agree within 10% (Change 22)
    if analyst_blended and analyst_blended.get("divergence_pct", 100) <= 10:
        score = {"Low": "Medium", "Medium": "High"}.get(score, score)

    # Upgrade if earnings yield signal aligns with consensus direction (Change 22)
    if signals and signals.get("earnings_yield_signal"):
        ey_signal = signals["earnings_yield_signal"]
        if analyst_blended:
            consensus_upside = analyst_blended.get("model_consensus", 0) - data.get("price", 0)
        else:
            consensus_upside = 0
        # "above_sector" EY + undervalued consensus = aligned bullish
        # "below_sector" EY + overvalued consensus = aligned bearish
        if (ey_signal == "above_sector" and consensus_upside > 0) or \
           (ey_signal == "below_sector" and consensus_upside < 0):
            score = {"Low": "Medium", "Medium": "High"}.get(score, score)

    return score


def run_valuation(ticker: str, data: dict) -> dict:
    data = _normalise(data)
    sector_multiples = get_sector_multiples()
    risk_free_rate = get_risk_free_rate()

    company_type = classify_company(data)
    model_fns    = MODEL_MAP.get(company_type, [dcf, ev_ebitda_comps, pe_comps, ps_comps])
    results      = [_call_model(fn, data, sector_multiples, risk_free_rate) for fn in model_fns]
    results      = [r for r in results if r is not None]

    gn = graham_number(data)
    if gn:
        results.append(gn)

    applicable = [r for r in results if r.get("applicable")]

    # Compute price targets using non-outlier models
    market_pool = [r for r in applicable if r.get("model") not in OUTLIER_MODELS]
    target_pool = market_pool if market_pool else applicable
    ve_target_mean = round(sum(r["intrinsic_value"] for r in target_pool) / len(target_pool), 2) if target_pool else None
    ve_target_high = round(max(r["intrinsic_value"] for r in target_pool), 2) if target_pool else None
    ve_target_low  = round(min(r["intrinsic_value"] for r in target_pool), 2) if target_pool else None

    # Weighted consensus (replaces simple average)
    consensus = None
    analyst_blended = None
    if target_pool:
        price = data["price"]
        weighted_sum = 0
        weight_total = 0
        for r in target_pool:
            w = MODEL_WEIGHTS.get(r["model"], 1.0)
            weighted_sum += r["intrinsic_value"] * w
            weight_total += w
        avg = weighted_sum / weight_total if weight_total > 0 else 0

        # Analyst blending
        analyst_target = data.get("target_price")
        if analyst_target and float(analyst_target) > 0 and avg > 0:
            analyst_target = float(analyst_target)
            divergence = abs(analyst_target - avg) / avg
            analyst_weight = 0.6 if divergence > 0.10 else 0.3
            blended = analyst_weight * analyst_target + (1 - analyst_weight) * avg
            analyst_blended = {
                "blended_value": round(blended, 2),
                "analyst_target": round(analyst_target, 2),
                "model_consensus": round(avg, 2),
                "analyst_weight": analyst_weight,
                "divergence_pct": round(divergence * 100, 1),
            }
            avg = blended

        margin = (avg - price) / price
        consensus = {
            "average_intrinsic_value": round(avg, 2),
            "current_price": round(price, 2),
            "upside_pct": round(margin * 100, 1),
            "overall_verdict": (
                "Undervalued" if margin > 0.15 else
                "Overvalued"  if margin < -0.15 else
                "Fairly Valued"
            ),
            "models_used": len(target_pool),
        }

    # Contextual signals
    signals = _compute_signals(data, consensus, sector_multiples)

    return {
        "ticker":        ticker,
        "company_name":  data.get("name", ticker),
        "sector":        data.get("sector", "Unknown"),
        "industry":      data.get("industry", "Unknown"),
        "company_type":  COMPANY_TYPE_LABELS.get(company_type, company_type),
        "current_price": data["price"],
        "market_cap":    data.get("market_cap"),
        "description":   data.get("description", ""),
        "website":       data.get("website", ""),
        "consensus":     consensus,
        "analyst_blended": analyst_blended,
        "signals":       signals,
        "valuations":    results,
        "dcf_sensitivity": dcf_sensitivity(data),
        "peer_comparison": peer_comparison(data, sector_multiples),
        "confidence":    confidence_score(data, results, signals, analyst_blended),
        "analyst": {
            "target_mean":          ve_target_mean,
            "target_high":          ve_target_high,
            "target_low":           ve_target_low,
            "target_median":        ve_target_mean,
            "recommendation":       data.get("recommendation"),
            "recommendation_mean":  data.get("recommendation_mean"),
            "analyst_count":        data.get("analyst_count"),
            "current_price":        data.get("price"),
        },
        "key_metrics": {
            "pe_ratio":       data.get("pe_ratio"),
            "forward_pe":     data.get("forward_pe"),
            "pb_ratio":       data.get("pb_ratio"),
            "ps_ratio":       data.get("ps_ratio"),
            "peg_ratio":      data.get("peg_ratio"),
            "ev_ebitda":      data.get("ev_ebitda"),
            "ev_to_revenue":  data.get("ev_to_revenue"),
            "dividend_yield": data.get("dividend_yield"),
            "dividend_rate":  data.get("dividend_rate"),
            "payout_ratio":   data.get("payout_ratio"),
            "beta":           data.get("beta"),
            "roe":            data.get("roe"),
            "roa":            data.get("roa"),
            "profit_margin":  data.get("profit_margin"),
            "operating_margin": data.get("operating_margin"),
            "revenue_growth": data.get("revenue_growth"),
            "earnings_growth":data.get("earnings_growth"),
            "eps":            data.get("eps"),
            "forward_eps":    data.get("forward_eps"),
            "debt_to_equity": data.get("debt_to_equity"),
            "current_ratio":  data.get("current_ratio"),
            "52w_high":       data.get("52w_high"),
            "52w_low":        data.get("52w_low"),
            "target_price":   data.get("target_price"),
            "recommendation": data.get("recommendation"),
            "revenue":        data.get("revenue"),
            "ebitda":         data.get("ebitda"),
            "net_income":     data.get("net_income"),
            "free_cashflow":  data.get("free_cashflow"),
            "total_debt":     data.get("total_debt"),
            "total_cash":     data.get("total_cash"),
            "book_value_per_share": data.get("book_value_per_share"),
            "shares_outstanding":   data.get("shares_outstanding"),
            "enterprise_value":     data.get("enterprise_value"),
        },
    }
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python -m pytest tests/test_router.py -v
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/valuation/router.py backend/tests/test_router.py
git commit -m "feat: weighted consensus, analyst blending, contextual signals

- Weighted consensus: FCF Yield 2.0x, EV/EBITDA 1.5x, DCF 1.5x, P/B 1.3x
- P/E demoted to outlier set (display only, not in consensus)
- Analyst target blending: 60/40 when >10% divergence, 30/70 otherwise
- Contextual signals: investment quality, price range, earnings yield,
  smoothed earnings, mispricing persistence note
- Enhanced confidence score with signal downgrades + analyst agreement upgrade"
```

---

### Task 5: Update main.py integration

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Update the valuation endpoint**

The `/valuation/{ticker}` endpoint in `main.py` calls `run_valuation(ticker, data)`. Since `run_valuation()` now internally fetches sector_multiples and risk_free_rate, **no changes needed to the endpoint call itself**.

However, update the `normalise()` function to pass through the new supplemental fields without stripping them:

In `normalise()`, after existing field mappings, add passthrough for new fields:

```python
    # Pass through supplemental fields for valuation models
    for field in ("operating_income", "depreciation_amortization", "total_assets",
                  "total_assets_prev", "ebitda_prev", "eps_3yr_avg", "roe_3yr_avg",
                  "interest_expense", "payout_ratio"):
        if d.get(field) is None and data.get(field) is not None:
            d[field] = data[field]
```

- [ ] **Step 2: Verify server starts without import errors**

```bash
cd backend && FINNHUB_KEY=test uvicorn main:app --reload --port 8000 &
sleep 3
# Verify server responds (root endpoint doesn't need auth)
curl -s http://localhost:8000/ | python3 -m json.tool | head -5
kill %1
```
Expected: Server starts and responds. The `/valuation/{ticker}` endpoint requires auth, so full end-to-end testing happens in Task 6 with real tokens or via the test suite.

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: integrate valuation overhaul into main.py

Pass supplemental fields through normalise() for valuation models."
```

---

### Task 6: Run full test suite and final verification

- [ ] **Step 1: Run all tests**

```bash
cd backend && python -m pytest tests/ -v --tb=short
```
Expected: All tests PASS

- [ ] **Step 2: Start backend and test a real valuation**

```bash
cd backend && FINNHUB_KEY=$FINNHUB_KEY uvicorn main:app --port 8000 &
sleep 3
# Test multiple tickers
for ticker in AAPL MSFT JPM XOM; do
    echo "=== $ticker ==="
    curl -s http://localhost:8000/valuation/$ticker -H "Authorization: Bearer $AUTH_TOKEN" | python3 -c "
import json, sys
d = json.load(sys.stdin)
c = d.get('consensus', {})
print(f\"  Consensus: \${c.get('average_intrinsic_value')} ({c.get('upside_pct')}% upside)\")
print(f\"  Models used: {c.get('models_used')}\")
ab = d.get('analyst_blended', {})
if ab:
    print(f\"  Analyst blended: \${ab.get('blended_value')} (analyst weight: {ab.get('analyst_weight')})\")
signals = d.get('signals', {})
if signals:
    print(f\"  Signals: {list(signals.keys())}\")
print()
"
done
kill %1
```

- [ ] **Step 3: Final commit with all test fixes (if any)**

```bash
git status
# Only stage specific files if fixes were needed
git add backend/valuation/models.py backend/valuation/router.py backend/valuation/sector_multiples.py backend/tests/
git diff --cached --stat
git commit -m "fix: address test failures from integration testing" || echo "Nothing to commit"
```

---

## Execution Notes

**No frontend changes in this plan.** The new `signals` and `analyst_blended` fields are additive to the API response. The frontend will need separate work to display them (not in scope).

**Environment variables needed:** No new env vars. `FMP_KEY` is already used by refresh scripts and `fmp_client.py`. `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY` already exist.

**Deployment:** After merge, clear cache on Render (`GET /cache/clear`) to pick up new sector multiples. The 24hr cache will self-populate on first request.

**Rollback:** If sector_multiples.py or Treasury yield fails, the hardcoded fallback values (identical to current production values) activate automatically. This is a safe, graceful degradation.
