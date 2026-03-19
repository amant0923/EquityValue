"""Tests for portfolio_builder module — TDD approach."""

import numpy as np
import pytest

# ── Task 2: Ledoit-Wolf + GMV ────────────────────────────────────────

class TestLedoitWolfShrink:
    def test_ledoit_wolf_shrink_returns_positive_definite(self):
        from portfolio_builder import ledoit_wolf_shrink
        rng = np.random.default_rng(42)
        returns = rng.standard_normal((252, 10))
        cov = ledoit_wolf_shrink(returns)
        # Symmetric
        assert np.allclose(cov, cov.T, atol=1e-10)
        # Positive-definite: all eigenvalues > 0
        eigenvalues = np.linalg.eigvalsh(cov)
        assert np.all(eigenvalues > 0)

    def test_ledoit_wolf_shrink_reduces_extreme_eigenvalues(self):
        from portfolio_builder import ledoit_wolf_shrink
        rng = np.random.default_rng(42)
        returns = rng.standard_normal((252, 10))
        sample_cov = np.cov(returns, rowvar=False)
        shrunk_cov = ledoit_wolf_shrink(returns)
        sample_eigs = np.linalg.eigvalsh(sample_cov)
        shrunk_eigs = np.linalg.eigvalsh(shrunk_cov)
        # Shrinkage should reduce the spread (max/min ratio)
        sample_spread = sample_eigs[-1] / sample_eigs[0]
        shrunk_spread = shrunk_eigs[-1] / shrunk_eigs[0]
        assert shrunk_spread < sample_spread


class TestOptimizeMinVariance:
    def test_optimize_min_variance_weights_sum_to_one(self):
        from portfolio_builder import ledoit_wolf_shrink, optimize_min_variance
        rng = np.random.default_rng(42)
        returns = rng.standard_normal((252, 5))
        cov = ledoit_wolf_shrink(returns)
        weights = optimize_min_variance(cov, {"min_position": 0.05, "max_position": 0.4})
        assert pytest.approx(sum(weights), abs=1e-6) == 1.0
        assert all(w >= 0.05 - 1e-6 for w in weights)
        assert all(w <= 0.4 + 1e-6 for w in weights)

    def test_optimize_min_variance_no_short_selling(self):
        from portfolio_builder import ledoit_wolf_shrink, optimize_min_variance
        rng = np.random.default_rng(99)
        returns = rng.standard_normal((252, 5))
        cov = ledoit_wolf_shrink(returns)
        weights = optimize_min_variance(cov, {"min_position": 0.0, "max_position": 1.0})
        assert all(w >= -1e-8 for w in weights)


# ── Task 3: Black-Litterman EVS + HRP ───────────────────────────────

class TestOptimizeBlackLittermanEVS:
    def test_optimize_bl_evs_higher_evs_gets_more_weight(self):
        from portfolio_builder import optimize_black_litterman_evs
        # Use a neutral (identity-scaled) covariance so EVS signal dominates
        N = 3
        cov = np.eye(N) * 0.04  # equal variance for all stocks
        evs_scores = [90, 50, 50]
        weights = optimize_black_litterman_evs(
            cov, evs_scores, {"min_position": 0.05, "max_position": 0.8}
        )
        # Stock 0 (EVS=90) should get the largest weight
        assert weights[0] > weights[1]
        assert weights[0] > weights[2]

    def test_optimize_bl_evs_respects_constraints(self):
        from portfolio_builder import ledoit_wolf_shrink, optimize_black_litterman_evs
        rng = np.random.default_rng(42)
        returns = rng.standard_normal((252, 5))
        cov = ledoit_wolf_shrink(returns)
        evs_scores = [80, 70, 60, 50, 40]
        weights = optimize_black_litterman_evs(
            cov, evs_scores, {"min_position": 0.05, "max_position": 0.25}
        )
        assert pytest.approx(sum(weights), abs=1e-6) == 1.0
        assert all(w >= 0.05 - 1e-6 for w in weights)
        assert all(w <= 0.25 + 1e-6 for w in weights)


class TestOptimizeHRP:
    def test_optimize_hrp_weights_sum_to_one(self):
        from portfolio_builder import optimize_hrp
        rng = np.random.default_rng(42)
        returns = rng.standard_normal((252, 8))
        weights = optimize_hrp(returns, {"min_position": 0.0, "max_position": 1.0})
        assert pytest.approx(sum(weights), abs=1e-6) == 1.0
        assert all(w >= -1e-8 for w in weights)

    def test_optimize_hrp_diversified(self):
        from portfolio_builder import optimize_hrp
        rng = np.random.default_rng(42)
        returns = rng.standard_normal((252, 10))
        weights = optimize_hrp(returns, {"min_position": 0.0, "max_position": 1.0})
        assert all(w < 0.5 for w in weights)


# ── Task 4: Risk profiling + sector templates ────────────────────────

GICS_SECTORS = [
    "Information Technology", "Health Care", "Consumer Staples",
    "Utilities", "Financials", "Industrials", "Energy",
    "Consumer Discretionary", "Communication Services",
    "Real Estate", "Basic Materials",
]


class TestComputeRiskProfile:
    def test_compute_risk_profile_sliders_only(self):
        from portfolio_builder import compute_risk_profile
        result = compute_risk_profile({"risk": 7, "horizon": 8, "income": 3})
        assert 0 < result["score"] <= 100
        assert result["profile"] in [
            "conservative", "moderately_conservative", "moderate",
            "moderately_aggressive", "aggressive",
        ]

    def test_compute_risk_profile_with_refine(self):
        from portfolio_builder import compute_risk_profile
        base = compute_risk_profile({"risk": 5, "horizon": 5, "income": 5})
        refined = compute_risk_profile(
            {"risk": 5, "horizon": 5, "income": 5},
            refine_answers={"emergency_fund": False, "debt_level": "high"},
        )
        # Conservative refine answers should lower the score
        assert refined["score"] < base["score"]


class TestGetSectorTemplate:
    def test_get_sector_template_sums_to_100(self):
        from portfolio_builder import get_sector_template, PROFILES
        for profile in PROFILES:
            tmpl = get_sector_template(profile)
            assert pytest.approx(sum(tmpl.values()), abs=1e-9) == 1.0

    def test_get_sector_template_uses_gics_names(self):
        from portfolio_builder import get_sector_template, PROFILES
        for profile in PROFILES:
            tmpl = get_sector_template(profile)
            for sector in GICS_SECTORS:
                assert sector in tmpl, f"Missing {sector} in {profile}"


# ── Task 5: Stock selection + orchestrators ──────────────────────────

class TestSelectStocks:
    def test_select_stocks_respects_sector_allocation(self):
        from portfolio_builder import select_stocks
        # 6 stocks per sector across 3 sectors (18 total, enough for medium)
        evs_data = [
            {"ticker": "AAPL", "sector": "Information Technology", "score": 80, "price": 150},
            {"ticker": "MSFT", "sector": "Information Technology", "score": 90, "price": 300},
            {"ticker": "GOOG", "sector": "Information Technology", "score": 70, "price": 130},
            {"ticker": "NVDA", "sector": "Information Technology", "score": 85, "price": 800},
            {"ticker": "AVGO", "sector": "Information Technology", "score": 75, "price": 170},
            {"ticker": "CRM",  "sector": "Information Technology", "score": 60, "price": 250},
            {"ticker": "JNJ",  "sector": "Health Care", "score": 65, "price": 160},
            {"ticker": "PFE",  "sector": "Health Care", "score": 55, "price": 30},
            {"ticker": "UNH",  "sector": "Health Care", "score": 75, "price": 500},
            {"ticker": "ABBV", "sector": "Health Care", "score": 72, "price": 170},
            {"ticker": "MRK",  "sector": "Health Care", "score": 68, "price": 120},
            {"ticker": "TMO",  "sector": "Health Care", "score": 58, "price": 550},
            {"ticker": "JPM",  "sector": "Financials", "score": 60, "price": 180},
            {"ticker": "BAC",  "sector": "Financials", "score": 50, "price": 35},
            {"ticker": "GS",   "sector": "Financials", "score": 70, "price": 400},
            {"ticker": "MS",   "sector": "Financials", "score": 62, "price": 90},
            {"ticker": "BLK",  "sector": "Financials", "score": 66, "price": 800},
            {"ticker": "C",    "sector": "Financials", "score": 48, "price": 60},
        ]
        template = {
            "Information Technology": 0.40,
            "Health Care": 0.35,
            "Financials": 0.25,
        }
        selected = select_stocks(template, "medium", evs_data)
        assert 10 <= len(selected) <= 15

    def test_select_stocks_merges_thin_sectors(self):
        from portfolio_builder import select_stocks
        evs_data = [
            {"ticker": "AAPL", "sector": "Information Technology", "score": 80, "price": 150},
            {"ticker": "MSFT", "sector": "Information Technology", "score": 90, "price": 300},
            {"ticker": "CAT",  "sector": "Industrials", "score": 65, "price": 250},
            {"ticker": "HON",  "sector": "Industrials", "score": 60, "price": 200},
            # Basic Materials has only 1 stock — should merge into Industrials
            {"ticker": "NEM",  "sector": "Basic Materials", "score": 45, "price": 40},
        ]
        template = {
            "Information Technology": 0.50,
            "Industrials": 0.30,
            "Basic Materials": 0.20,
        }
        selected = select_stocks(template, "small", evs_data)
        # NEM should appear (merged into Industrials bucket)
        tickers = [s["ticker"] for s in selected]
        assert "NEM" in tickers

    def test_select_stocks_prefers_higher_evs(self):
        from portfolio_builder import select_stocks
        evs_data = [
            {"ticker": "MSFT", "sector": "Information Technology", "score": 90, "price": 300},
            {"ticker": "AAPL", "sector": "Information Technology", "score": 80, "price": 150},
            {"ticker": "INTC", "sector": "Information Technology", "score": 30, "price": 25},
        ]
        template = {"Information Technology": 1.0}
        selected = select_stocks(template, "small", evs_data)
        tickers = [s["ticker"] for s in selected]
        # MSFT and AAPL should be selected before INTC
        assert "MSFT" in tickers
        assert "AAPL" in tickers


class TestBuildAllocation:
    def test_build_allocation_returns_complete_allocation(self):
        from portfolio_builder import _build_allocation
        tickers = ["AAPL", "MSFT", "JNJ", "JPM", "PG"]
        evs_data = {
            "AAPL": {"score": 80, "sector": "Information Technology"},
            "MSFT": {"score": 90, "sector": "Information Technology"},
            "JNJ":  {"score": 65, "sector": "Health Care"},
            "JPM":  {"score": 60, "sector": "Financials"},
            "PG":   {"score": 70, "sector": "Consumer Staples"},
        }
        rng = np.random.default_rng(42)
        returns_data = rng.standard_normal((252, 5))
        prices = {"AAPL": 150.0, "MSFT": 300.0, "JNJ": 160.0, "JPM": 180.0, "PG": 140.0}

        result = _build_allocation(
            tickers, evs_data, returns_data, prices,
            profile="moderate",
            investment_amount=100_000,
        )
        # Must have allocation list
        assert "allocations" in result
        assert len(result["allocations"]) == 5
        for alloc in result["allocations"]:
            assert "ticker" in alloc
            assert "weight" in alloc
            assert "shares" in alloc
            assert "sector" in alloc
            assert "evs_score" in alloc
            assert alloc["shares"] >= 0
        # Weights should sum to ~1
        total_weight = sum(a["weight"] for a in result["allocations"])
        assert pytest.approx(total_weight, abs=1e-4) == 1.0
        # Must have risk metrics and sector breakdown
        assert "risk_metrics" in result
        assert "sector_breakdown" in result
