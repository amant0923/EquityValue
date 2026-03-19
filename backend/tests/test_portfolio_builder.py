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
