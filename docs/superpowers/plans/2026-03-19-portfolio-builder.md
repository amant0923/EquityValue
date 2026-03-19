# Portfolio Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a wizard-based portfolio builder that recommends stock allocations based on user risk profile, using Ledoit-Wolf shrinkage, Black-Litterman EVS views, and HRP optimization.

**Architecture:** New `portfolio_builder.py` backend module handles all optimization math. Two new API routes (`/portfolio/build`, `/portfolio/optimize`) call the builder and persist via existing portfolio CRUD. Frontend wizard page with shared components across both "Build For Me" and "Optimize Mine" modes.

**Tech Stack:** Python (numpy, scipy), FastAPI, React, Recharts (existing), Supabase

**Spec:** `docs/superpowers/specs/2026-03-19-portfolio-builder-design.md`

---

## File Structure

### Backend (new files)
| File | Responsibility |
|------|---------------|
| `backend/portfolio_builder.py` | All optimization logic: risk profiling, sector templates, Ledoit-Wolf shrinkage, GMV, Black-Litterman EVS, HRP, stock selection |
| `backend/routes/portfolio_build.py` | Two API routes: `POST /portfolio/build`, `POST /portfolio/optimize`. Auth + tier enforcement + calls builder + persists portfolio |
| `backend/tests/test_portfolio_builder.py` | Unit tests for optimization functions |

### Backend (modified files)
| File | Change |
|------|--------|
| `backend/requirements.txt` | Add `scipy>=1.12,<2.0` |
| `backend/main.py` | Import and include new router |

### Frontend (new files)
| File | Responsibility |
|------|---------------|
| `frontend/src/pages/PortfolioBuildPage.jsx` | Wizard container: step management, mode state, API calls |
| `frontend/src/components/portfolio/BuildModeSelector.jsx` | "Build For Me" vs "Optimize Mine" cards |
| `frontend/src/components/portfolio/RiskSliders.jsx` | 3 range sliders + expandable refine questions |
| `frontend/src/components/portfolio/StockCountPicker.jsx` | 3 range option cards (small/medium/large) |
| `frontend/src/components/portfolio/ProfileResult.jsx` | Computed risk score display + method info |
| `frontend/src/components/portfolio/StockPicker.jsx` | Multi-select ticker search for Optimize Mine |
| `frontend/src/components/portfolio/OptimizeSettings.jsx` | Method selector (MV/HRP) + max position slider |
| `frontend/src/components/portfolio/AllocationReview.jsx` | Sector donut + holdings table + risk metrics + actions |

### Frontend (modified files)
| File | Change |
|------|--------|
| `frontend/src/App.jsx` | Add lazy import + route for `/portfolio/build` |
| `frontend/src/pages/PortfolioListPage.jsx` | Add "Build a Portfolio" button next to existing "Create Portfolio" |

---

## Task 1: Add scipy dependency

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add scipy to requirements**

Add after line 5 (`numpy>=1.26,<3.0`):
```
scipy>=1.12,<2.0
```

- [ ] **Step 2: Install and verify**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && pip install scipy>=1.12`
Expected: Successfully installed scipy

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore: add scipy dependency for portfolio optimizer"
```

---

## Task 2: Ledoit-Wolf shrinkage + GMV optimizer (core math)

**Files:**
- Create: `backend/portfolio_builder.py`
- Create: `backend/tests/test_portfolio_builder.py`

- [ ] **Step 1: Write failing tests for Ledoit-Wolf shrinkage**

```python
# backend/tests/test_portfolio_builder.py
import numpy as np
import pytest


def test_ledoit_wolf_shrink_returns_positive_definite():
    """Shrunk covariance must be symmetric positive-definite."""
    from portfolio_builder import ledoit_wolf_shrink
    np.random.seed(42)
    # 252 days, 10 stocks — typical 1yr daily returns
    returns = np.random.randn(252, 10) * 0.02
    cov = ledoit_wolf_shrink(returns)
    assert cov.shape == (10, 10)
    # Symmetric
    assert np.allclose(cov, cov.T)
    # Positive-definite: all eigenvalues > 0
    eigenvalues = np.linalg.eigvalsh(cov)
    assert np.all(eigenvalues > 0)


def test_ledoit_wolf_shrink_reduces_extreme_eigenvalues():
    """Shrinkage should pull eigenvalues toward the mean vs sample cov."""
    from portfolio_builder import ledoit_wolf_shrink
    np.random.seed(42)
    returns = np.random.randn(252, 10) * 0.02
    sample_cov = np.cov(returns, rowvar=False)
    shrunk_cov = ledoit_wolf_shrink(returns)
    sample_eigs = np.sort(np.linalg.eigvalsh(sample_cov))
    shrunk_eigs = np.sort(np.linalg.eigvalsh(shrunk_cov))
    # Shrinkage should reduce spread of eigenvalues
    sample_spread = sample_eigs[-1] - sample_eigs[0]
    shrunk_spread = shrunk_eigs[-1] - shrunk_eigs[0]
    assert shrunk_spread < sample_spread


def test_optimize_min_variance_weights_sum_to_one():
    """GMV weights must sum to 1 and respect constraints."""
    from portfolio_builder import optimize_min_variance
    np.random.seed(42)
    returns = np.random.randn(252, 5) * 0.02
    cov = np.cov(returns, rowvar=False)
    constraints = {"max_position": 0.4, "min_position": 0.05}
    weights = optimize_min_variance(cov, constraints)
    assert len(weights) == 5
    assert abs(sum(weights) - 1.0) < 1e-6
    assert all(w >= 0.05 - 1e-6 for w in weights)
    assert all(w <= 0.4 + 1e-6 for w in weights)


def test_optimize_min_variance_no_short_selling():
    """All weights must be non-negative (long-only)."""
    from portfolio_builder import optimize_min_variance
    np.random.seed(42)
    returns = np.random.randn(252, 8) * 0.02
    cov = np.cov(returns, rowvar=False)
    constraints = {"max_position": 0.3, "min_position": 0.01}
    weights = optimize_min_variance(cov, constraints)
    assert all(w >= -1e-6 for w in weights)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && python3 -m pytest tests/test_portfolio_builder.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'portfolio_builder'`

- [ ] **Step 3: Implement Ledoit-Wolf shrinkage and GMV optimizer**

```python
# backend/portfolio_builder.py
"""Portfolio builder — risk profiling, optimization, and allocation."""
import numpy as np
from scipy.optimize import minimize


# ── Covariance Estimation ─────────────────────────────────────────

def ledoit_wolf_shrink(returns: np.ndarray) -> np.ndarray:
    """Ledoit-Wolf shrinkage toward constant-correlation target.

    Args:
        returns: T x N matrix of asset returns (rows=observations, cols=assets)
    Returns:
        N x N shrunk covariance matrix (symmetric, positive-definite)
    """
    T, N = returns.shape
    # Demean
    X = returns - returns.mean(axis=0)
    sample_cov = (X.T @ X) / T

    # Target: constant-correlation model
    var = np.diag(sample_cov)
    std = np.sqrt(var)
    # Average correlation (off-diagonal)
    corr = sample_cov / np.outer(std, std)
    np.fill_diagonal(corr, 0)
    rho_bar = corr.sum() / (N * (N - 1))
    target = rho_bar * np.outer(std, std)
    np.fill_diagonal(target, var)

    # Optimal shrinkage intensity (Ledoit & Wolf 2004, Eq. 2)
    # Estimate squared Frobenius norm of (sample - target)
    delta = sample_cov - target
    # Sum of squared elements of X_i X_j / T - sigma_ij
    Y = X ** 2
    phi = (Y.T @ Y) / T - sample_cov ** 2
    kappa = phi.sum() / (delta ** 2).sum()
    shrinkage = max(0, min(1, kappa / T))

    return shrinkage * target + (1 - shrinkage) * sample_cov


# ── Minimum Variance Optimizer ────────────────────────────────────

def optimize_min_variance(cov: np.ndarray, constraints: dict) -> list[float]:
    """Global Minimum Variance portfolio via constrained optimization.

    Args:
        cov: N x N covariance matrix
        constraints: dict with max_position, min_position
    Returns:
        List of N weights summing to 1
    """
    N = cov.shape[0]
    max_pos = constraints.get("max_position", 0.15)
    min_pos = constraints.get("min_position", 0.01)

    def objective(w):
        return w @ cov @ w  # portfolio variance

    cons = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
    bounds = [(min_pos, max_pos)] * N
    w0 = np.ones(N) / N  # start from equal weight

    result = minimize(objective, w0, method="SLSQP",
                      bounds=bounds, constraints=cons,
                      options={"maxiter": 1000, "ftol": 1e-12})
    weights = result.x
    # Normalise to exactly 1.0
    weights = weights / weights.sum()
    return weights.tolist()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && python3 -m pytest tests/test_portfolio_builder.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/portfolio_builder.py backend/tests/test_portfolio_builder.py
git commit -m "feat: add Ledoit-Wolf shrinkage and GMV optimizer"
```

---

## Task 3: Black-Litterman EVS optimizer + HRP

**Files:**
- Modify: `backend/portfolio_builder.py`
- Modify: `backend/tests/test_portfolio_builder.py`

- [ ] **Step 1: Write failing tests for BL-EVS and HRP**

Append to `backend/tests/test_portfolio_builder.py`:

```python
def test_optimize_bl_evs_higher_evs_gets_more_weight():
    """Stocks with higher EVS scores should get larger weights."""
    from portfolio_builder import optimize_black_litterman_evs
    np.random.seed(42)
    returns = np.random.randn(252, 4) * 0.02
    cov = np.cov(returns, rowvar=False)
    # Stock 0 has highest EVS
    evs_scores = [90, 50, 50, 50]
    constraints = {"max_position": 0.4, "min_position": 0.05}
    weights = optimize_black_litterman_evs(cov, evs_scores, constraints)
    assert abs(sum(weights) - 1.0) < 1e-6
    # Highest EVS stock should have the largest weight
    assert weights[0] == max(weights)


def test_optimize_bl_evs_respects_constraints():
    """BL-EVS weights must stay within position limits."""
    from portfolio_builder import optimize_black_litterman_evs
    np.random.seed(42)
    returns = np.random.randn(252, 6) * 0.02
    cov = np.cov(returns, rowvar=False)
    evs_scores = [95, 80, 70, 60, 50, 40]
    constraints = {"max_position": 0.25, "min_position": 0.05}
    weights = optimize_black_litterman_evs(cov, evs_scores, constraints)
    assert all(w >= 0.05 - 1e-6 for w in weights)
    assert all(w <= 0.25 + 1e-6 for w in weights)


def test_optimize_hrp_weights_sum_to_one():
    """HRP weights must sum to 1 and be non-negative."""
    from portfolio_builder import optimize_hrp
    np.random.seed(42)
    returns = np.random.randn(252, 8) * 0.02
    constraints = {"max_position": 0.3, "min_position": 0.01}
    weights = optimize_hrp(returns, constraints)
    assert len(weights) == 8
    assert abs(sum(weights) - 1.0) < 1e-6
    assert all(w >= 0 for w in weights)


def test_optimize_hrp_diversified():
    """HRP should not concentrate >50% in any single stock for 8+ stocks."""
    from portfolio_builder import optimize_hrp
    np.random.seed(42)
    returns = np.random.randn(252, 10) * 0.02
    constraints = {"max_position": 0.3, "min_position": 0.01}
    weights = optimize_hrp(returns, constraints)
    assert max(weights) < 0.5
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && python3 -m pytest tests/test_portfolio_builder.py -v`
Expected: 4 passed, 4 failed (new tests)

- [ ] **Step 3: Implement BL-EVS optimizer**

Add to `backend/portfolio_builder.py`:

```python
# ── Black-Litterman EVS Optimizer ─────────────────────────────────

def optimize_black_litterman_evs(cov: np.ndarray, evs_scores: list[float],
                                  constraints: dict) -> list[float]:
    """Black-Litterman-style optimization using EVS as confidence-weighted views.

    Prior: equal-weight. Views: EVS scores as tilts away from equal weight.
    Higher EVS = stronger view that stock deserves more weight.

    Args:
        cov: N x N shrunk covariance matrix
        evs_scores: list of N EVS scores (1-100)
        constraints: dict with max_position, min_position
    Returns:
        List of N weights summing to 1
    """
    N = cov.shape[0]
    max_pos = constraints.get("max_position", 0.15)
    min_pos = constraints.get("min_position", 0.01)
    scores = np.array(evs_scores, dtype=float)

    # Prior: equal weight
    prior = np.ones(N) / N

    # View: normalised EVS scores as expected return proxy
    # Scale to small magnitude so optimizer doesn't overfit
    tau = 0.05  # confidence scaling factor
    view_returns = tau * (scores - scores.mean()) / (scores.std() + 1e-8)

    # BL posterior expected return: prior_return + tau * Sigma * views
    # Simplified: we use view_returns directly as the return estimate
    mu = view_returns

    def objective(w):
        # Maximise: mu'w - (lambda/2) * w'Σw
        risk_aversion = 2.5
        return -(mu @ w - (risk_aversion / 2) * w @ cov @ w)

    cons = [{"type": "eq", "fun": lambda w: np.sum(w) - 1.0}]
    bounds = [(min_pos, max_pos)] * N
    w0 = prior.copy()

    result = minimize(objective, w0, method="SLSQP",
                      bounds=bounds, constraints=cons,
                      options={"maxiter": 1000, "ftol": 1e-12})
    weights = result.x / result.x.sum()
    return weights.tolist()
```

- [ ] **Step 4: Implement HRP optimizer**

Add to `backend/portfolio_builder.py`:

```python
# ── Hierarchical Risk Parity ─────────────────────────────────────

def optimize_hrp(returns: np.ndarray, constraints: dict) -> list[float]:
    """Hierarchical Risk Parity (López de Prado 2016).

    Clusters stocks by correlation, allocates risk inversely to cluster volatility.
    No matrix inversion — inherently more stable than MV.

    Args:
        returns: T x N matrix of asset returns
        constraints: dict with max_position, min_position
    Returns:
        List of N weights summing to 1
    """
    from scipy.cluster.hierarchy import linkage, leaves_list
    from scipy.spatial.distance import squareform

    T, N = returns.shape
    max_pos = constraints.get("max_position", 0.3)
    min_pos = constraints.get("min_position", 0.01)

    cov = np.cov(returns, rowvar=False)
    corr = np.corrcoef(returns, rowvar=False)

    # Distance matrix from correlation
    dist = np.sqrt(0.5 * (1 - corr))
    np.fill_diagonal(dist, 0)
    dist = (dist + dist.T) / 2  # ensure symmetry
    condensed = squareform(dist, checks=False)

    # Hierarchical clustering
    link = linkage(condensed, method="single")
    sort_ix = leaves_list(link).tolist()

    # Recursive bisection
    weights = np.ones(N)

    def _bisect(items):
        if len(items) <= 1:
            return
        mid = len(items) // 2
        left = items[:mid]
        right = items[mid:]

        # Cluster variance (inverse-variance allocation)
        cov_left = cov[np.ix_(left, left)]
        cov_right = cov[np.ix_(right, right)]

        # Inverse-variance weight for each cluster
        w_left_inv = 1.0 / np.diag(cov_left).sum()
        w_right_inv = 1.0 / np.diag(cov_right).sum()
        alpha = w_left_inv / (w_left_inv + w_right_inv)

        weights[left] *= alpha
        weights[right] *= (1 - alpha)

        _bisect(left)
        _bisect(right)

    _bisect(sort_ix)

    # Normalise
    weights = weights / weights.sum()

    # Clip to constraints
    weights = np.clip(weights, min_pos, max_pos)
    weights = weights / weights.sum()

    return weights.tolist()
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && python3 -m pytest tests/test_portfolio_builder.py -v`
Expected: 8 passed

- [ ] **Step 6: Commit**

```bash
git add backend/portfolio_builder.py backend/tests/test_portfolio_builder.py
git commit -m "feat: add Black-Litterman EVS optimizer and HRP"
```

---

## Task 4: Risk profiling + sector templates + stock selection

**Files:**
- Modify: `backend/portfolio_builder.py`
- Modify: `backend/tests/test_portfolio_builder.py`

- [ ] **Step 1: Write failing tests for risk profiling and sector templates**

Append to `backend/tests/test_portfolio_builder.py`:

```python
def test_compute_risk_profile_sliders_only():
    """Sliders alone should produce a valid profile."""
    from portfolio_builder import compute_risk_profile
    sliders = {"risk_tolerance": 7, "investment_horizon": 8, "income_preference": 3}
    score, profile = compute_risk_profile(sliders, refine_answers=None)
    assert 1 <= score <= 100
    assert profile in [
        "conservative", "moderately_conservative", "moderate",
        "moderately_aggressive", "aggressive"
    ]


def test_compute_risk_profile_with_refine():
    """Refine answers should adjust score by up to ±15."""
    from portfolio_builder import compute_risk_profile
    sliders = {"risk_tolerance": 5, "investment_horizon": 5, "income_preference": 5}
    score_base, _ = compute_risk_profile(sliders, refine_answers=None)
    refine = {"drop_reaction": "sell_all", "net_worth_pct": "over_50", "goal": "preserve"}
    score_refined, profile = compute_risk_profile(sliders, refine_answers=refine)
    # Conservative refine answers should lower the score
    assert score_refined < score_base
    assert profile in ["conservative", "moderately_conservative"]


def test_get_sector_template_sums_to_100():
    """Every profile's sector template must sum to 100%."""
    from portfolio_builder import get_sector_template
    for profile in ["conservative", "moderately_conservative", "moderate",
                    "moderately_aggressive", "aggressive"]:
        template = get_sector_template(profile)
        total = sum(template.values())
        assert abs(total - 1.0) < 0.01, f"{profile} sums to {total}"


def test_get_sector_template_uses_gics_names():
    """Sector names must match FMP GICS classification."""
    from portfolio_builder import get_sector_template
    template = get_sector_template("moderate")
    expected_sectors = {
        "Information Technology", "Health Care", "Consumer Staples",
        "Utilities", "Financials", "Industrials", "Energy",
        "Consumer Discretionary", "Communication Services",
        "Real Estate", "Basic Materials"
    }
    assert set(template.keys()) == expected_sectors
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && python3 -m pytest tests/test_portfolio_builder.py::test_compute_risk_profile_sliders_only tests/test_portfolio_builder.py::test_get_sector_template_sums_to_100 -v`
Expected: FAIL

- [ ] **Step 3: Implement risk profiling**

Add to `backend/portfolio_builder.py`:

```python
# ── Risk Profiling ────────────────────────────────────────────────

PROFILES = [
    (20, "conservative"),
    (40, "moderately_conservative"),
    (60, "moderate"),
    (80, "moderately_aggressive"),
    (100, "aggressive"),
]

REFINE_ADJUSTMENTS = {
    "drop_reaction": {"hold": 0, "buy_more": 5, "sell_some": -5, "sell_all": -10},
    "net_worth_pct": {"under_10": 3, "10_to_30": 0, "30_to_50": -3, "over_50": -5},
    "goal": {"preserve": -5, "income": -3, "balanced": 0, "max_growth": 5},
}


def compute_risk_profile(sliders: dict, refine_answers: dict | None) -> tuple[int, str]:
    """Compute risk score (1-100) and profile name from questionnaire.

    Args:
        sliders: {risk_tolerance: 1-10, investment_horizon: 1-10, income_preference: 1-10}
        refine_answers: optional {drop_reaction, net_worth_pct, goal}
    Returns:
        (score, profile_name)
    """
    # Base score: weighted average of sliders scaled to 1-100
    rt = sliders["risk_tolerance"]
    ih = sliders["investment_horizon"]
    ip = sliders["income_preference"]
    base = (rt * 0.5 + ih * 0.3 + ip * 0.2) * 10  # 10-100 range

    # Refine adjustment (±15 max)
    adjust = 0
    if refine_answers:
        for key, val in refine_answers.items():
            if key in REFINE_ADJUSTMENTS and val in REFINE_ADJUSTMENTS[key]:
                adjust += REFINE_ADJUSTMENTS[key][val]
    adjust = max(-15, min(15, adjust))

    score = int(max(1, min(100, base + adjust)))

    # Map to profile
    profile = "aggressive"
    for threshold, name in PROFILES:
        if score <= threshold:
            profile = name
            break

    return score, profile
```

- [ ] **Step 4: Implement sector templates**

Add to `backend/portfolio_builder.py`:

```python
# ── Sector Allocation Templates ───────────────────────────────────

SECTOR_TEMPLATES = {
    "conservative": {
        "Information Technology": 0.08, "Health Care": 0.14,
        "Consumer Staples": 0.19, "Utilities": 0.14,
        "Financials": 0.11, "Industrials": 0.09,
        "Energy": 0.07, "Consumer Discretionary": 0.05,
        "Communication Services": 0.05, "Real Estate": 0.05,
        "Basic Materials": 0.03,
    },
    "moderately_conservative": {
        "Information Technology": 0.13, "Health Care": 0.14,
        "Consumer Staples": 0.14, "Utilities": 0.09,
        "Financials": 0.12, "Industrials": 0.11,
        "Energy": 0.07, "Consumer Discretionary": 0.06,
        "Communication Services": 0.06, "Real Estate": 0.05,
        "Basic Materials": 0.03,
    },
    "moderate": {
        "Information Technology": 0.23, "Health Care": 0.14,
        "Consumer Staples": 0.09, "Utilities": 0.04,
        "Financials": 0.14, "Industrials": 0.11,
        "Energy": 0.07, "Consumer Discretionary": 0.05,
        "Communication Services": 0.05, "Real Estate": 0.05,
        "Basic Materials": 0.03,
    },
    "moderately_aggressive": {
        "Information Technology": 0.28, "Health Care": 0.11,
        "Consumer Staples": 0.04, "Utilities": 0.02,
        "Financials": 0.14, "Industrials": 0.09,
        "Energy": 0.05, "Consumer Discretionary": 0.10,
        "Communication Services": 0.09, "Real Estate": 0.05,
        "Basic Materials": 0.03,
    },
    "aggressive": {
        "Information Technology": 0.33, "Health Care": 0.11,
        "Consumer Staples": 0.02, "Utilities": 0.00,
        "Financials": 0.14, "Industrials": 0.09,
        "Energy": 0.05, "Consumer Discretionary": 0.10,
        "Communication Services": 0.09, "Real Estate": 0.04,
        "Basic Materials": 0.03,
    },
}

# Related sector pairs for thin-sector merging
SECTOR_MERGE_MAP = {
    "Basic Materials": "Industrials",
    "Real Estate": "Financials",
    "Utilities": "Consumer Staples",
    "Communication Services": "Information Technology",
}

STOCK_COUNT_RANGES = {"small": (5, 10), "medium": (10, 15), "large": (15, 25)}


def get_sector_template(profile: str) -> dict[str, float]:
    """Return sector allocation template for the given risk profile."""
    return SECTOR_TEMPLATES.get(profile, SECTOR_TEMPLATES["moderate"]).copy()
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && python3 -m pytest tests/test_portfolio_builder.py -v`
Expected: 12 passed

- [ ] **Step 6: Commit**

```bash
git add backend/portfolio_builder.py backend/tests/test_portfolio_builder.py
git commit -m "feat: add risk profiling and sector allocation templates"
```

---

## Task 5: Stock selection + build/optimize orchestrators

**Files:**
- Modify: `backend/portfolio_builder.py`
- Modify: `backend/tests/test_portfolio_builder.py`

- [ ] **Step 1: Write failing tests for stock selection and orchestrators**

Append to `backend/tests/test_portfolio_builder.py`:

```python
def test_select_stocks_respects_sector_allocation():
    """select_stocks should pick stocks proportionally to sector template."""
    from portfolio_builder import select_stocks
    template = {"Information Technology": 0.5, "Health Care": 0.3, "Financials": 0.2}
    # Mock EVS data: {ticker: {evs_score, sector, current_price}}
    evs_data = {
        "AAPL": {"evs_score": 80, "sector": "Information Technology", "current_price": 180},
        "MSFT": {"evs_score": 85, "sector": "Information Technology", "current_price": 400},
        "NVDA": {"evs_score": 70, "sector": "Information Technology", "current_price": 900},
        "GOOGL": {"evs_score": 75, "sector": "Information Technology", "current_price": 170},
        "UNH": {"evs_score": 78, "sector": "Health Care", "current_price": 500},
        "LLY": {"evs_score": 72, "sector": "Health Care", "current_price": 800},
        "JNJ": {"evs_score": 65, "sector": "Health Care", "current_price": 160},
        "JPM": {"evs_score": 76, "sector": "Financials", "current_price": 200},
        "BAC": {"evs_score": 60, "sector": "Financials", "current_price": 40},
    }
    tickers = select_stocks(template, "medium", evs_data)
    assert 10 <= len(tickers) <= 15
    # Should have tech stocks (highest allocation)
    tech_tickers = [t for t in tickers if evs_data[t]["sector"] == "Information Technology"]
    assert len(tech_tickers) >= 2


def test_select_stocks_merges_thin_sectors():
    """Thin sectors (<2 stocks) should merge into related sector."""
    from portfolio_builder import select_stocks
    template = {"Basic Materials": 0.50, "Industrials": 0.50}
    evs_data = {
        "NEM": {"evs_score": 70, "sector": "Basic Materials", "current_price": 40},
        # Only 1 Basic Materials stock — should merge into Industrials
        "CAT": {"evs_score": 75, "sector": "Industrials", "current_price": 250},
        "HON": {"evs_score": 72, "sector": "Industrials", "current_price": 200},
        "GE": {"evs_score": 68, "sector": "Industrials", "current_price": 170},
    }
    tickers = select_stocks(template, "small", evs_data)
    # NEM should still be selected (it exists), plus Industrials stocks fill the rest
    assert "NEM" in tickers
    assert len(tickers) >= 4  # should pull in Industrials to fill


def test_select_stocks_prefers_higher_evs():
    """Within a sector, higher EVS stocks should be selected first."""
    from portfolio_builder import select_stocks
    template = {"Information Technology": 1.0}
    evs_data = {
        "MSFT": {"evs_score": 90, "sector": "Information Technology", "current_price": 400},
        "AAPL": {"evs_score": 80, "sector": "Information Technology", "current_price": 180},
        "INTC": {"evs_score": 30, "sector": "Information Technology", "current_price": 25},
    }
    tickers = select_stocks(template, "small", evs_data)
    # MSFT (90) and AAPL (80) should be picked before INTC (30)
    assert "MSFT" in tickers
    assert "AAPL" in tickers


def test_build_allocation_returns_complete_allocation():
    """_build_allocation should return allocation, sector_breakdown, risk_metrics."""
    from portfolio_builder import _build_allocation
    evs_data = {
        "AAPL": {"evs_score": 80, "sector": "Information Technology", "current_price": 180},
        "MSFT": {"evs_score": 85, "sector": "Information Technology", "current_price": 400},
        "UNH": {"evs_score": 78, "sector": "Health Care", "current_price": 500},
        "JPM": {"evs_score": 76, "sector": "Financials", "current_price": 200},
        "PG": {"evs_score": 70, "sector": "Consumer Staples", "current_price": 160},
    }
    returns_data = np.random.randn(252, 5) * 0.02
    result = _build_allocation(
        tickers=["AAPL", "MSFT", "UNH", "JPM", "PG"],
        evs_data=evs_data,
        returns_data=returns_data,
        profile="moderate",
        investment_amount=50000,
    )
    assert "allocation" in result
    assert "risk_metrics" in result
    assert len(result["allocation"]) == 5
    total_weight = sum(a["weight"] for a in result["allocation"])
    assert abs(total_weight - 1.0) < 0.01
    # Each holding should have ticker, weight, shares, sector, evs_score
    for a in result["allocation"]:
        assert all(k in a for k in ["ticker", "weight", "shares", "sector", "evs_score"])
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && python3 -m pytest tests/test_portfolio_builder.py -v -k "select_stocks or build_allocation"`
Expected: FAIL

- [ ] **Step 3: Implement stock selection**

Add to `backend/portfolio_builder.py`:

```python
# ── Stock Selection ───────────────────────────────────────────────

def select_stocks(sector_template: dict[str, float], stock_count: str,
                  evs_data: dict) -> list[str]:
    """Select stocks by sector allocation, ranked by EVS score.

    Args:
        sector_template: {sector_name: weight} from get_sector_template()
        stock_count: "small", "medium", or "large"
        evs_data: {ticker: {evs_score, sector, current_price}}
    Returns:
        List of selected tickers
    """
    lo, hi = STOCK_COUNT_RANGES.get(stock_count, (10, 15))
    target_count = (lo + hi) // 2  # aim for midpoint

    # Group stocks by sector
    sector_stocks = {}
    for ticker, data in evs_data.items():
        sector = data.get("sector", "Unknown")
        if sector in sector_template:
            sector_stocks.setdefault(sector, []).append(
                (ticker, data.get("evs_score") or 0, data.get("current_price", 0))
            )

    # Sort each sector by EVS descending (no-EVS stocks last)
    for sector in sector_stocks:
        sector_stocks[sector].sort(key=lambda x: x[1], reverse=True)

    # Allocate stock count per sector proportionally
    selected = []
    for sector, weight in sorted(sector_template.items(), key=lambda x: -x[1]):
        if weight <= 0 or sector not in sector_stocks:
            continue
        n = max(1, round(weight * target_count))
        available = sector_stocks[sector][:n]
        if len(available) < 2 and sector in SECTOR_MERGE_MAP:
            # Thin sector — merge into related sector
            merge_to = SECTOR_MERGE_MAP[sector]
            if merge_to in sector_stocks:
                available = (sector_stocks.get(sector, []) +
                             sector_stocks.get(merge_to, []))[:n]
        selected.extend([t[0] for t in available])

    # Trim or pad to target range
    selected = list(dict.fromkeys(selected))  # deduplicate preserving order
    if len(selected) > hi:
        selected = selected[:hi]
    elif len(selected) < lo:
        # Pad with highest-EVS stocks not yet selected
        remaining = sorted(
            [(t, d.get("evs_score") or 0) for t, d in evs_data.items() if t not in selected],
            key=lambda x: -x[1]
        )
        for t, _ in remaining:
            if len(selected) >= lo:
                break
            selected.append(t)

    return selected
```

- [ ] **Step 4: Implement build/optimize orchestrators**

Add to `backend/portfolio_builder.py`:

```python
import math

# ── Constraint Profiles ───────────────────────────────────────────

CONSTRAINT_PROFILES = {
    "conservative":              {"max_position": 0.08, "min_position": 0.01, "max_sector": 0.35},
    "moderately_conservative":   {"max_position": 0.09, "min_position": 0.01, "max_sector": 0.35},
    "moderate":                  {"max_position": 0.10, "min_position": 0.01, "max_sector": 0.35},
    "moderately_aggressive":     {"max_position": 0.12, "min_position": 0.01, "max_sector": 0.35},
    "aggressive":                {"max_position": 0.15, "min_position": 0.01, "max_sector": 0.35},
}


def _build_allocation(tickers: list[str], evs_data: dict,
                      returns_data: np.ndarray, profile: str,
                      investment_amount: float,
                      method: str = "auto",
                      max_position_override: float | None = None) -> dict:
    """Core allocation logic — shared by build and optimize modes.

    Args:
        tickers: ordered list of selected tickers
        evs_data: {ticker: {evs_score, sector, current_price}}
        returns_data: T x N returns matrix (columns match tickers order)
        profile: risk profile name
        investment_amount: total dollars to invest
        method: "auto", "mean_variance", or "hrp"
        max_position_override: optional max weight per stock
    Returns:
        {allocation: [...], sector_breakdown: {...}, risk_metrics: {...}}
    """
    N = len(tickers)
    constraints = CONSTRAINT_PROFILES.get(profile, CONSTRAINT_PROFILES["moderate"]).copy()
    if max_position_override:
        constraints["max_position"] = max_position_override

    # Shrink covariance
    cov = ledoit_wolf_shrink(returns_data)

    # Choose optimisation method
    evs_scores = [evs_data[t].get("evs_score") or 50 for t in tickers]

    if method == "hrp" or (method == "auto" and N > 15):
        weights = optimize_hrp(returns_data, constraints)
    elif profile in ("conservative", "moderately_conservative"):
        weights = optimize_min_variance(cov, constraints)
        # Light EVS tilt for mod-conservative
        if profile == "moderately_conservative":
            scores_arr = np.array(evs_scores, dtype=float)
            tilt = 0.02 * (scores_arr - scores_arr.mean()) / (scores_arr.std() + 1e-8)
            weights = [w + t for w, t in zip(weights, tilt)]
            total = sum(weights)
            weights = [w / total for w in weights]
    else:
        weights = optimize_black_litterman_evs(cov, evs_scores, constraints)

    # Build allocation list
    allocation = []
    sector_breakdown = {}
    for i, ticker in enumerate(tickers):
        info = evs_data[ticker]
        price = info.get("current_price", 1)
        weight = weights[i]
        shares = math.floor(weight * investment_amount / price) if price > 0 else 0
        sector = info.get("sector", "Unknown")
        sector_breakdown[sector] = sector_breakdown.get(sector, 0) + weight
        allocation.append({
            "ticker": ticker,
            "weight": round(weight, 4),
            "shares": shares,
            "avg_price": round(price, 2),
            "sector": sector,
            "evs_score": info.get("evs_score"),
        })

    # Risk metrics
    weights_arr = np.array(weights)
    annual_vol = float(np.sqrt(weights_arr @ cov @ weights_arr * 252))
    mean_returns = returns_data.mean(axis=0)
    annual_ret = float(weights_arr @ mean_returns * 252)
    sharpe = annual_ret / annual_vol if annual_vol > 0 else 0

    method_name = "hrp" if (method == "hrp" or (method == "auto" and N > 15)) else (
        "min_variance" if profile in ("conservative", "moderately_conservative")
        else "black_litterman_evs"
    )

    return {
        "allocation": sorted(allocation, key=lambda x: -x["weight"]),
        "sector_breakdown": {k: round(v, 4) for k, v in sorted(sector_breakdown.items(), key=lambda x: -x[1])},
        "risk_metrics": {
            "method": method_name,
            "covariance": "ledoit_wolf_shrinkage",
            "expected_annual_return": round(annual_ret, 4),
            "expected_annual_volatility": round(annual_vol, 4),
            "sharpe_ratio": round(sharpe, 2),
        },
    }
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && python3 -m pytest tests/test_portfolio_builder.py -v`
Expected: 16 passed

- [ ] **Step 6: Commit**

```bash
git add backend/portfolio_builder.py backend/tests/test_portfolio_builder.py
git commit -m "feat: add stock selection and build/optimize orchestrators"
```

---

## Task 6: API routes for portfolio builder

**Files:**
- Create: `backend/routes/portfolio_build.py`
- Modify: `backend/main.py` (lines 20, 128)

- [ ] **Step 1: Create the route file with request/response models**

```python
# backend/routes/portfolio_build.py
"""Routes for portfolio builder — guided and optimizer modes."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
import os
import numpy as np
import yfinance as yf
from supabase import create_client
from auth import get_current_user, get_user_profile
from portfolio_builder import (
    compute_risk_profile, get_sector_template, select_stocks,
    _build_allocation, STOCK_COUNT_RANGES,
)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://efbtgnplotlshrwbotfp.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmYnRnbnBsb3Rsc2hyd2JvdGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MDEzODIsImV4cCI6MjA4ODQ3NzM4Mn0.grKm3Rh-UtXU3bIz2ajLNiVxbfTECC9cwuslZe_BY-I")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY or SUPABASE_KEY)

router = APIRouter()


# ── Request Models ────────────────────────────────────────────────

class BuildRequest(BaseModel):
    risk_score: int = Field(..., ge=1, le=100)
    profile: Literal[
        "conservative", "moderately_conservative", "moderate",
        "moderately_aggressive", "aggressive"
    ]
    stock_count: Literal["small", "medium", "large"]
    investment_amount: float = Field(..., ge=1000)
    name: str = Field("", max_length=50)
    confirm: bool = Field(False)  # False=preview only, True=create portfolio


class OptimizeRequest(BaseModel):
    tickers: list[str] = Field(..., min_length=2, max_length=50)
    risk_score: int = Field(..., ge=1, le=100)
    profile: Literal[
        "conservative", "moderately_conservative", "moderate",
        "moderately_aggressive", "aggressive"
    ]
    method: Literal["mean_variance", "hrp"] = "mean_variance"
    investment_amount: float = Field(..., ge=1000)
    max_position: float | None = Field(None, ge=0.01, le=0.25)
    name: str = Field("", max_length=50)
    confirm: bool = Field(False)  # False=preview only, True=create portfolio


# ── Helpers ───────────────────────────────────────────────────────

def _fetch_evs_data() -> dict:
    """Fetch EVS scores + fundamentals for all S&P 500 stocks."""
    evs_rows = supabase.table("equity_value_scores").select("ticker, score, verdict").execute().data or []
    fund_rows = supabase.table("stock_fundamentals").select(
        "ticker, name, sector, current_price, market_cap"
    ).execute().data or []

    fund_map = {f["ticker"]: f for f in fund_rows}
    result = {}
    for f in fund_rows:
        ticker = f["ticker"]
        result[ticker] = {
            "name": f.get("name", ""),
            "sector": f.get("sector", "Unknown"),
            "current_price": f.get("current_price", 0),
            "market_cap": f.get("market_cap", 0),
            "evs_score": None,
        }
    for e in evs_rows:
        ticker = e["ticker"]
        if ticker in result:
            result[ticker]["evs_score"] = e.get("score")
    return result


def _fetch_returns(tickers: list[str], period: str = "1y") -> np.ndarray | None:
    """Fetch daily returns for given tickers via yfinance."""
    try:
        df = yf.download(tickers, period=period, progress=False, threads=True)["Close"]
        if df.empty:
            return None
        # Ensure column order matches tickers
        df = df[tickers] if len(tickers) > 1 else df.to_frame(tickers[0])
        returns = df.pct_change().dropna().values
        if returns.shape[0] < 60:  # need at least ~3 months
            return None
        return returns
    except Exception:
        return None


def _create_portfolio_with_holdings(user_id: str, name: str,
                                     allocation: list[dict]) -> str:
    """Create portfolio and add all holdings. Returns portfolio_id."""
    # Create portfolio
    result = supabase.table("user_portfolios").insert({
        "user_id": user_id, "name": name
    }).execute()
    portfolio_id = result.data[0]["id"]

    # Add holdings
    holdings = []
    for a in allocation:
        if a["shares"] > 0:
            holdings.append({
                "portfolio_id": portfolio_id,
                "ticker": a["ticker"],
                "shares": a["shares"],
                "avg_price": a["avg_price"],
            })
    if holdings:
        supabase.table("portfolio_holdings").insert(holdings).execute()

    return portfolio_id


# ── Routes ────────────────────────────────────────────────────────

@router.post("/portfolio/build")
async def build_portfolio_route(req: BuildRequest,
                                 user: dict = Depends(get_current_user)):
    """Guided portfolio builder — questionnaire → allocation → create."""
    user_id = user["sub"]

    # Check portfolio limit
    profile_data = await get_user_profile(user_id)
    plan = profile_data.get("plan", "free")
    from routes.portfolio import PORTFOLIO_LIMITS
    max_p, _ = PORTFOLIO_LIMITS.get(plan, PORTFOLIO_LIMITS["free"])
    existing = supabase.table("user_portfolios").select("id", count="exact") \
        .eq("user_id", user_id).execute()
    if existing.count >= max_p:
        raise HTTPException(403, "Portfolio limit reached. Upgrade for more.")

    # Fetch data
    evs_data = _fetch_evs_data()
    if not evs_data:
        raise HTTPException(500, "Unable to fetch stock data")

    # Select stocks
    template = get_sector_template(req.profile)
    tickers = select_stocks(template, req.stock_count, evs_data)
    if len(tickers) < 2:
        raise HTTPException(500, "Not enough stocks available for allocation")

    # Fetch returns
    returns = _fetch_returns(tickers)
    if returns is None:
        raise HTTPException(500, "Unable to fetch price history for selected stocks")

    # Build allocation
    result = _build_allocation(
        tickers=tickers,
        evs_data=evs_data,
        returns_data=returns,
        profile=req.profile,
        investment_amount=req.investment_amount,
    )

    # Only persist if confirm=True (prevents orphaned portfolios on regenerate)
    portfolio_id = None
    if req.confirm:
        name = req.name or f"{req.profile.replace('_', ' ').title()} Portfolio"
        portfolio_id = _create_portfolio_with_holdings(
            user_id, name, result["allocation"]
        )

    return {"portfolio_id": portfolio_id, "profile": req.profile, **result}


@router.post("/portfolio/optimize")
async def optimize_portfolio_route(req: OptimizeRequest,
                                    user: dict = Depends(get_current_user)):
    """Manual optimizer — user picks stocks → system optimizes weights."""
    user_id = user["sub"]

    # Pro+ only
    profile_data = await get_user_profile(user_id)
    plan = profile_data.get("plan", "free")
    if plan == "free":
        raise HTTPException(403, "Portfolio optimizer requires Pro or Max plan.")

    # Validate tickers
    evs_data = _fetch_evs_data()
    invalid = [t for t in req.tickers if t not in evs_data]
    if invalid:
        raise HTTPException(400, f"Unknown tickers: {', '.join(invalid)}")

    # Fetch returns
    returns = _fetch_returns(req.tickers)
    if returns is None:
        raise HTTPException(500, "Unable to fetch price history")

    # Optimize
    result = _build_allocation(
        tickers=req.tickers,
        evs_data=evs_data,
        returns_data=returns,
        profile=req.profile,
        investment_amount=req.investment_amount,
        method=req.method,
        max_position_override=req.max_position,
    )

    # Only persist if confirm=True
    portfolio_id = None
    if req.confirm:
        name = req.name or "Optimized Portfolio"
        portfolio_id = _create_portfolio_with_holdings(
            user_id, name, result["allocation"]
        )

    return {"portfolio_id": portfolio_id, "profile": req.profile, **result}
```

- [ ] **Step 2: Register router in main.py**

In `backend/main.py`, add import at line 21 (after portfolio import):
```python
from routes.portfolio_build import router as portfolio_build_router
```

Add include at line 129 (after portfolio include):
```python
app.include_router(portfolio_build_router)
```

- [ ] **Step 3: Verify backend starts without errors**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && python3 -c "from routes.portfolio_build import router; print('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/routes/portfolio_build.py backend/main.py
git commit -m "feat: add /portfolio/build and /portfolio/optimize API routes"
```

---

## Task 7: Frontend — BuildModeSelector + RiskSliders components

**Files:**
- Create: `frontend/src/components/portfolio/BuildModeSelector.jsx`
- Create: `frontend/src/components/portfolio/RiskSliders.jsx`

- [ ] **Step 1: Create BuildModeSelector**

```jsx
// frontend/src/components/portfolio/BuildModeSelector.jsx
import "./BuildModeSelector.css";

export default function BuildModeSelector({ selected, onSelect }) {
  return (
    <div className="build-mode-selector">
      <div
        className={`mode-card ${selected === "guided" ? "active" : ""}`}
        onClick={() => onSelect("guided")}
      >
        <div className="mode-icon">🎯</div>
        <h3>Build For Me</h3>
        <p>Answer a few questions and get a portfolio tailored to your risk profile</p>
      </div>
      <div
        className={`mode-card ${selected === "optimize" ? "active" : ""}`}
        onClick={() => onSelect("optimize")}
      >
        <div className="mode-icon">⚖️</div>
        <h3>Optimize Mine</h3>
        <p>Pick your stocks and let the optimizer find the best allocation</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create BuildModeSelector.css**

```css
/* frontend/src/components/portfolio/BuildModeSelector.css */
.build-mode-selector {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin: 24px 0;
}
.mode-card {
  flex: 1;
  max-width: 320px;
  padding: 24px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  cursor: pointer;
  text-align: center;
  transition: border-color 0.2s, background 0.2s;
}
.mode-card:hover { border-color: var(--accent); }
.mode-card.active {
  border-color: var(--accent);
  background: rgba(99, 102, 241, 0.08);
}
.mode-icon { font-size: 32px; margin-bottom: 8px; }
.mode-card h3 { margin: 0 0 6px; font-size: 16px; }
.mode-card p { margin: 0; font-size: 13px; color: var(--text-secondary); }
```

- [ ] **Step 3: Create RiskSliders**

```jsx
// frontend/src/components/portfolio/RiskSliders.jsx
import { useState } from "react";
import "./RiskSliders.css";

const REFINE_QUESTIONS = [
  {
    key: "drop_reaction",
    label: "How would you react to a 20% portfolio drop?",
    options: [
      { value: "hold", label: "Hold steady" },
      { value: "buy_more", label: "Buy more" },
      { value: "sell_some", label: "Sell some" },
      { value: "sell_all", label: "Sell all" },
    ],
  },
  {
    key: "net_worth_pct",
    label: "What % of your net worth is this portfolio?",
    options: [
      { value: "under_10", label: "<10%" },
      { value: "10_to_30", label: "10-30%" },
      { value: "30_to_50", label: "30-50%" },
      { value: "over_50", label: ">50%" },
    ],
  },
  {
    key: "goal",
    label: "Primary goal?",
    options: [
      { value: "preserve", label: "Preserve capital" },
      { value: "income", label: "Steady income" },
      { value: "balanced", label: "Balanced growth" },
      { value: "max_growth", label: "Maximum growth" },
    ],
  },
];

export default function RiskSliders({ sliders, onSlidersChange, refine, onRefineChange }) {
  const [showRefine, setShowRefine] = useState(false);

  const handleSlider = (key, val) => {
    onSlidersChange({ ...sliders, [key]: Number(val) });
  };

  const handleRefine = (key, val) => {
    onRefineChange({ ...refine, [key]: val });
  };

  return (
    <div className="risk-sliders">
      {[
        { key: "risk_tolerance", label: "Risk Tolerance", low: "Conservative", high: "Aggressive" },
        { key: "investment_horizon", label: "Investment Horizon", low: "1 year", high: "10+ years" },
        { key: "income_preference", label: "Income Preference", low: "Dividends", high: "Growth" },
      ].map((s) => (
        <div key={s.key} className="slider-row">
          <div className="slider-header">
            <span>{s.label}</span>
            <span className="slider-value">{sliders[s.key]} / 10</span>
          </div>
          <input
            type="range" min="1" max="10" value={sliders[s.key]}
            onChange={(e) => handleSlider(s.key, e.target.value)}
          />
          <div className="slider-labels">
            <span>{s.low}</span><span>{s.high}</span>
          </div>
        </div>
      ))}

      <div className="refine-toggle" onClick={() => setShowRefine(!showRefine)}>
        <span className="refine-arrow">{showRefine ? "▲" : "▼"}</span>
        <span>Refine your profile (optional)</span>
      </div>

      {showRefine && (
        <div className="refine-section">
          {REFINE_QUESTIONS.map((q) => (
            <div key={q.key} className="refine-question">
              <p>{q.label}</p>
              <div className="refine-options">
                {q.options.map((opt) => (
                  <button
                    key={opt.value}
                    className={`refine-btn ${refine[q.key] === opt.value ? "active" : ""}`}
                    onClick={() => handleRefine(q.key, opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create RiskSliders.css**

```css
/* frontend/src/components/portfolio/RiskSliders.css */
.risk-sliders { max-width: 500px; margin: 0 auto; }
.slider-row { margin-bottom: 20px; }
.slider-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; }
.slider-value { color: var(--accent); font-weight: 500; }
.slider-row input[type="range"] { width: 100%; accent-color: var(--accent); }
.slider-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary); }
.refine-toggle {
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  color: var(--accent); font-size: 13px; padding: 12px 0;
  border-top: 1px solid var(--border); margin-top: 8px;
}
.refine-section { padding: 12px 0; }
.refine-question { margin-bottom: 16px; }
.refine-question p { margin: 0 0 8px; font-size: 13px; }
.refine-options { display: flex; gap: 8px; flex-wrap: wrap; }
.refine-btn {
  padding: 6px 12px; border: 1px solid var(--border); border-radius: 6px;
  background: transparent; color: var(--text-primary); font-size: 12px; cursor: pointer;
}
.refine-btn.active { border-color: var(--accent); background: rgba(99, 102, 241, 0.12); color: var(--accent); }
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/portfolio/BuildModeSelector.jsx \
        frontend/src/components/portfolio/BuildModeSelector.css \
        frontend/src/components/portfolio/RiskSliders.jsx \
        frontend/src/components/portfolio/RiskSliders.css
git commit -m "feat: add BuildModeSelector and RiskSliders components"
```

---

## Task 8: Frontend — StockCountPicker, ProfileResult, StockPicker, OptimizeSettings

**Files:**
- Create: `frontend/src/components/portfolio/StockCountPicker.jsx`
- Create: `frontend/src/components/portfolio/ProfileResult.jsx`
- Create: `frontend/src/components/portfolio/StockPicker.jsx`
- Create: `frontend/src/components/portfolio/OptimizeSettings.jsx`

- [ ] **Step 1: Create StockCountPicker**

```jsx
// frontend/src/components/portfolio/StockCountPicker.jsx
import "./StockCountPicker.css";

const OPTIONS = [
  { value: "small", label: "5-10", desc: "Concentrated" },
  { value: "medium", label: "10-15", desc: "Balanced" },
  { value: "large", label: "15-25", desc: "Diversified" },
];

export default function StockCountPicker({ selected, onSelect }) {
  return (
    <div className="stock-count-picker">
      <p className="picker-label">How many stocks would you like in your portfolio?</p>
      <div className="count-options">
        {OPTIONS.map((o) => (
          <div
            key={o.value}
            className={`count-card ${selected === o.value ? "active" : ""}`}
            onClick={() => onSelect(o.value)}
          >
            <div className="count-value">{o.label}</div>
            <div className="count-desc">{o.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create StockCountPicker.css**

```css
/* frontend/src/components/portfolio/StockCountPicker.css */
.stock-count-picker { text-align: center; }
.picker-label { font-size: 14px; color: var(--text-secondary); margin-bottom: 16px; }
.count-options { display: flex; gap: 12px; justify-content: center; }
.count-card {
  padding: 14px 24px; border: 1px solid var(--border); border-radius: 10px;
  cursor: pointer; text-align: center; min-width: 90px; transition: all 0.2s;
}
.count-card:hover { border-color: var(--accent); }
.count-card.active { border-color: var(--accent); background: rgba(99, 102, 241, 0.08); }
.count-value { font-size: 18px; font-weight: 600; }
.count-desc { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
```

- [ ] **Step 3: Create ProfileResult**

```jsx
// frontend/src/components/portfolio/ProfileResult.jsx
import "./ProfileResult.css";

const PROFILE_LABELS = {
  conservative: "Conservative",
  moderately_conservative: "Moderately Conservative",
  moderate: "Moderate",
  moderately_aggressive: "Moderately Aggressive",
  aggressive: "Aggressive",
};

const METHOD_LABELS = {
  conservative: "Global Minimum Variance",
  moderately_conservative: "GMV + EVS Tilt",
  moderate: "Black-Litterman + EVS",
  moderately_aggressive: "Black-Litterman + EVS",
  aggressive: "Black-Litterman + EVS",
};

export default function ProfileResult({ score, profile }) {
  return (
    <div className="profile-result">
      <div className="score-badge">
        <div className="score-label">Risk Score</div>
        <div className="score-value">{score}</div>
        <div className="profile-name">{PROFILE_LABELS[profile]}</div>
      </div>
      <div className="profile-details">
        <div className="detail-item">
          <span className="detail-label">Method</span>
          <span>{METHOD_LABELS[profile]}</span>
        </div>
        <div className="detail-item">
          <span className="detail-label">Covariance</span>
          <span>Ledoit-Wolf Shrinkage</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ProfileResult.css**

```css
/* frontend/src/components/portfolio/ProfileResult.css */
.profile-result { text-align: center; padding: 16px 0; }
.score-badge {
  display: inline-block; padding: 20px 40px; border-radius: 12px;
  border: 1px solid rgba(99, 102, 241, 0.3); background: rgba(99, 102, 241, 0.08);
}
.score-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary); }
.score-value { font-size: 42px; font-weight: 700; color: var(--accent); line-height: 1.1; }
.profile-name { font-size: 16px; font-weight: 600; margin-top: 4px; }
.profile-details { display: flex; gap: 24px; justify-content: center; margin-top: 16px; }
.detail-item { text-align: center; }
.detail-label { display: block; font-size: 11px; color: var(--text-secondary); text-transform: uppercase; }
```

- [ ] **Step 5: Create StockPicker**

```jsx
// frontend/src/components/portfolio/StockPicker.jsx
import { useState, useRef } from "react";
import "./StockPicker.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function StockPicker({ selected, onSelect, maxStocks = 50 }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const debounce = useRef(null);

  const search = (val) => {
    setQuery(val);
    clearTimeout(debounce.current);
    if (val.length < 1) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/search/${val}`);
        const data = await res.json();
        setResults((data || []).slice(0, 8));
      } catch { setResults([]); }
    }, 200);
  };

  const add = (ticker) => {
    if (!selected.includes(ticker) && selected.length < maxStocks) {
      onSelect([...selected, ticker]);
    }
    setQuery("");
    setResults([]);
  };

  const remove = (ticker) => {
    onSelect(selected.filter((t) => t !== ticker));
  };

  return (
    <div className="stock-picker">
      <p className="picker-label">Search and select stocks for your portfolio</p>
      <div className="picker-search-wrap">
        <input
          value={query}
          onChange={(e) => search(e.target.value.toUpperCase())}
          placeholder="Search ticker or company..."
          className="picker-input"
        />
        {results.length > 0 && (
          <div className="picker-dropdown">
            {results.map((r) => (
              <div key={r.ticker} className="picker-result" onClick={() => add(r.ticker)}>
                <span className="picker-ticker">{r.ticker}</span>
                <span className="picker-name">{r.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="picker-selected">
          {selected.map((t) => (
            <span key={t} className="ticker-chip">
              {t} <button onClick={() => remove(t)}>×</button>
            </span>
          ))}
        </div>
      )}
      <p className="picker-count">{selected.length} / {maxStocks} stocks selected</p>
    </div>
  );
}
```

- [ ] **Step 6: Create StockPicker.css**

```css
/* frontend/src/components/portfolio/StockPicker.css */
.stock-picker { max-width: 500px; margin: 0 auto; }
.picker-label { font-size: 14px; color: var(--text-secondary); margin-bottom: 12px; text-align: center; }
.picker-search-wrap { position: relative; }
.picker-input {
  width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px;
  background: var(--card-bg); color: var(--text-primary); font-size: 14px; box-sizing: border-box;
}
.picker-dropdown {
  position: absolute; top: 100%; left: 0; right: 0; background: var(--card-bg);
  border: 1px solid var(--border); border-radius: 8px; margin-top: 4px; z-index: 10;
  max-height: 240px; overflow-y: auto;
}
.picker-result {
  padding: 8px 14px; cursor: pointer; display: flex; gap: 8px; align-items: center;
}
.picker-result:hover { background: rgba(99, 102, 241, 0.08); }
.picker-ticker { font-weight: 600; min-width: 60px; }
.picker-name { font-size: 13px; color: var(--text-secondary); }
.picker-selected { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.ticker-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px;
  background: rgba(99, 102, 241, 0.12); border-radius: 6px; font-size: 13px; font-weight: 500;
}
.ticker-chip button {
  background: none; border: none; color: var(--text-secondary); cursor: pointer;
  font-size: 14px; padding: 0 2px;
}
.picker-count { text-align: center; font-size: 12px; color: var(--text-secondary); margin-top: 8px; }
```

- [ ] **Step 7: Create OptimizeSettings**

```jsx
// frontend/src/components/portfolio/OptimizeSettings.jsx
import "./OptimizeSettings.css";

export default function OptimizeSettings({ method, onMethodChange, maxPosition, onMaxPositionChange, stockCount }) {
  return (
    <div className="optimize-settings">
      <div className="setting-group">
        <label>Optimization Method</label>
        <div className="method-options">
          <button
            className={`method-btn ${method === "mean_variance" ? "active" : ""}`}
            onClick={() => onMethodChange("mean_variance")}
          >
            Mean-Variance
          </button>
          <button
            className={`method-btn ${method === "hrp" ? "active" : ""}`}
            onClick={() => onMethodChange("hrp")}
            disabled={stockCount <= 15}
            title={stockCount <= 15 ? "HRP recommended for 15+ stocks" : ""}
          >
            HRP {stockCount <= 15 && "(15+ stocks)"}
          </button>
        </div>
      </div>
      <div className="setting-group">
        <label>Max Single Position: {Math.round(maxPosition * 100)}%</label>
        <input
          type="range" min="5" max="25" value={Math.round(maxPosition * 100)}
          onChange={(e) => onMaxPositionChange(Number(e.target.value) / 100)}
        />
        <div className="range-labels"><span>5%</span><span>25%</span></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Create OptimizeSettings.css**

```css
/* frontend/src/components/portfolio/OptimizeSettings.css */
.optimize-settings { max-width: 400px; margin: 0 auto; }
.setting-group { margin-bottom: 20px; }
.setting-group label { display: block; font-size: 14px; margin-bottom: 8px; }
.method-options { display: flex; gap: 8px; }
.method-btn {
  flex: 1; padding: 10px; border: 1px solid var(--border); border-radius: 8px;
  background: transparent; color: var(--text-primary); cursor: pointer; font-size: 13px;
}
.method-btn.active { border-color: var(--accent); background: rgba(99, 102, 241, 0.08); }
.method-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.setting-group input[type="range"] { width: 100%; accent-color: var(--accent); }
.range-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary); }
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/portfolio/StockCountPicker.jsx \
        frontend/src/components/portfolio/StockCountPicker.css \
        frontend/src/components/portfolio/ProfileResult.jsx \
        frontend/src/components/portfolio/ProfileResult.css \
        frontend/src/components/portfolio/StockPicker.jsx \
        frontend/src/components/portfolio/StockPicker.css \
        frontend/src/components/portfolio/OptimizeSettings.jsx \
        frontend/src/components/portfolio/OptimizeSettings.css
git commit -m "feat: add StockCountPicker, ProfileResult, StockPicker, OptimizeSettings"
```

---

## Task 9: Frontend — AllocationReview component

**Files:**
- Create: `frontend/src/components/portfolio/AllocationReview.jsx`
- Create: `frontend/src/components/portfolio/AllocationReview.css`

- [ ] **Step 1: Create AllocationReview**

```jsx
// frontend/src/components/portfolio/AllocationReview.jsx
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import "./AllocationReview.css";

const COLORS = [
  "#6366f1", "#818cf8", "#10b981", "#fbbf24", "#f97316",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#a855f7"
];

export default function AllocationReview({ allocation, sectorBreakdown, riskMetrics, onRegenerate, onCreate, loading }) {
  const sectorData = Object.entries(sectorBreakdown || {}).map(([name, weight], i) => ({
    name, value: Math.round(weight * 100), fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="allocation-review">
      <div className="review-grid">
        <div className="review-chart">
          <h4>Sector Allocation</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                   innerRadius={50} outerRadius={80} paddingAngle={2}>
                {sectorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v}%`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="sector-legend">
            {sectorData.map((s, i) => (
              <span key={s.name} className="legend-item">
                <span className="legend-dot" style={{ background: COLORS[i % COLORS.length] }} />
                {s.name} {s.value}%
              </span>
            ))}
          </div>
        </div>
        <div className="review-table">
          <h4>Holdings</h4>
          <table>
            <thead>
              <tr><th>Ticker</th><th>Sector</th><th>Weight</th><th>Shares</th><th>EVS</th></tr>
            </thead>
            <tbody>
              {(allocation || []).map((a) => (
                <tr key={a.ticker}>
                  <td className="ticker-cell">{a.ticker}</td>
                  <td className="sector-cell">{a.sector}</td>
                  <td>{(a.weight * 100).toFixed(1)}%</td>
                  <td>{a.shares}</td>
                  <td className="evs-cell">{a.evs_score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="risk-metrics-bar">
        <div className="metric">
          <span className="metric-label">Est. Return</span>
          <span className="metric-value green">
            {((riskMetrics?.expected_annual_return || 0) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Est. Volatility</span>
          <span className="metric-value yellow">
            {((riskMetrics?.expected_annual_volatility || 0) * 100).toFixed(1)}%
          </span>
        </div>
        <div className="metric">
          <span className="metric-label">Sharpe Ratio</span>
          <span className="metric-value">{riskMetrics?.sharpe_ratio ?? "—"}</span>
        </div>
      </div>

      <div className="review-actions">
        <button className="btn-secondary" onClick={onRegenerate} disabled={loading}>
          Regenerate
        </button>
        <button className="btn-primary" onClick={onCreate} disabled={loading}>
          {loading ? "Creating..." : "Create Portfolio"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create AllocationReview.css**

```css
/* frontend/src/components/portfolio/AllocationReview.css */
.allocation-review { max-width: 800px; margin: 0 auto; }
.review-grid { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 20px; }
.review-chart { flex: 1; min-width: 240px; }
.review-chart h4, .review-table h4 { margin: 0 0 12px; font-size: 14px; }
.sector-legend { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.legend-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--text-secondary); }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.review-table { flex: 2; min-width: 300px; overflow-x: auto; }
.review-table table { width: 100%; border-collapse: collapse; font-size: 13px; }
.review-table th { text-align: left; padding: 6px 8px; color: var(--text-secondary); font-size: 11px; text-transform: uppercase; border-bottom: 1px solid var(--border); }
.review-table td { padding: 6px 8px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.ticker-cell { font-weight: 600; }
.sector-cell { color: var(--text-secondary); }
.evs-cell { color: #10b981; }
.risk-metrics-bar {
  display: flex; gap: 24px; justify-content: center; padding: 16px 0;
  border-top: 1px solid var(--border); border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}
.metric { text-align: center; }
.metric-label { display: block; font-size: 10px; text-transform: uppercase; color: var(--text-secondary); }
.metric-value { font-size: 18px; font-weight: 600; }
.metric-value.green { color: #10b981; }
.metric-value.yellow { color: #fbbf24; }
.review-actions { display: flex; gap: 12px; justify-content: center; }
.review-actions .btn-secondary {
  padding: 10px 20px; border: 1px solid var(--border); border-radius: 8px;
  background: transparent; color: var(--text-primary); cursor: pointer; font-size: 13px;
}
.review-actions .btn-primary {
  padding: 10px 28px; background: var(--accent); border: none; border-radius: 8px;
  color: white; font-weight: 600; cursor: pointer; font-size: 13px;
}
.review-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/portfolio/AllocationReview.jsx \
        frontend/src/components/portfolio/AllocationReview.css
git commit -m "feat: add AllocationReview component with sector chart and risk metrics"
```

---

## Task 10: Frontend — PortfolioBuildPage wizard + route registration

**Files:**
- Create: `frontend/src/pages/PortfolioBuildPage.jsx`
- Modify: `frontend/src/App.jsx` (lines 40, 301)
- Modify: `frontend/src/pages/PortfolioListPage.jsx` (near line 59)

- [ ] **Step 1: Create PortfolioBuildPage**

```jsx
// frontend/src/pages/PortfolioBuildPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";
import BuildModeSelector from "../components/portfolio/BuildModeSelector";
import RiskSliders from "../components/portfolio/RiskSliders";
import StockCountPicker from "../components/portfolio/StockCountPicker";
import ProfileResult from "../components/portfolio/ProfileResult";
import StockPicker from "../components/portfolio/StockPicker";
import OptimizeSettings from "../components/portfolio/OptimizeSettings";
import AllocationReview from "../components/portfolio/AllocationReview";
import "./PortfolioBuildPage.css";

const STEPS_GUIDED = ["mode", "risk", "count", "profile", "review"];
const STEPS_OPTIMIZE = ["mode", "stocks", "risk", "settings", "review"];

function computeScore(sliders, refine) {
  const base = (sliders.risk_tolerance * 0.5 + sliders.investment_horizon * 0.3 + sliders.income_preference * 0.2) * 10;
  const adj = { drop_reaction: { hold: 0, buy_more: 5, sell_some: -5, sell_all: -10 },
    net_worth_pct: { under_10: 3, "10_to_30": 0, "30_to_50": -3, over_50: -5 },
    goal: { preserve: -5, income: -3, balanced: 0, max_growth: 5 } };
  let adjust = 0;
  Object.entries(refine).forEach(([k, v]) => { if (adj[k]?.[v] !== undefined) adjust += adj[k][v]; });
  adjust = Math.max(-15, Math.min(15, adjust));
  return Math.max(1, Math.min(100, Math.round(base + adjust)));
}

function scoreToProfile(score) {
  if (score <= 20) return "conservative";
  if (score <= 40) return "moderately_conservative";
  if (score <= 60) return "moderate";
  if (score <= 80) return "moderately_aggressive";
  return "aggressive";
}

export default function PortfolioBuildPage() {
  const navigate = useNavigate();
  const { profile: userProfile } = useAuth();
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState(0);
  const [sliders, setSliders] = useState({ risk_tolerance: 5, investment_horizon: 5, income_preference: 5 });
  const [refine, setRefine] = useState({});
  const [stockCount, setStockCount] = useState("medium");
  const [selectedStocks, setSelectedStocks] = useState([]);
  const [method, setMethod] = useState("mean_variance");
  const [maxPosition, setMaxPosition] = useState(0.1);
  const [investmentAmount, setInvestmentAmount] = useState(10000);
  const [portfolioName, setPortfolioName] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const score = computeScore(sliders, refine);
  const riskProfile = scoreToProfile(score);
  const steps = mode === "optimize" ? STEPS_OPTIMIZE : STEPS_GUIDED;
  const currentStep = steps[step];

  const canProceed = () => {
    if (currentStep === "mode") return !!mode;
    if (currentStep === "stocks") return selectedStocks.length >= 2;
    if (currentStep === "risk") return true;
    if (currentStep === "count") return !!stockCount;
    if (currentStep === "profile") return true;
    if (currentStep === "settings") return true;
    return false;
  };

  const buildPayload = () => {
    if (mode === "guided") {
      return { url: "/portfolio/build", body: {
        risk_score: score, profile: riskProfile,
        stock_count: stockCount, investment_amount: investmentAmount,
        name: portfolioName || `${riskProfile.replace(/_/g, " ")} Portfolio`,
      }};
    }
    return { url: "/portfolio/optimize", body: {
      tickers: selectedStocks, risk_score: score, profile: riskProfile,
      method, investment_amount: investmentAmount,
      max_position: maxPosition,
      name: portfolioName || "Optimized Portfolio",
    }};
  };

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const { url, body } = buildPayload();
      const res = await api.post(url, { ...body, confirm: false });
      setResult(res.data);
      setStep(steps.length - 1);
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to build portfolio");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (step < steps.length - 2) {
      setStep(step + 1);
      return;
    }
    await fetchPreview();
  };

  const handleRegenerate = () => {
    setResult(null);
    fetchPreview();  // re-fetch without setTimeout race condition
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { url, body } = buildPayload();
      const res = await api.post(url, { ...body, confirm: true });
      if (res.data.portfolio_id) {
        navigate(`/portfolio/${res.data.portfolio_id}`);
      }
    } catch (e) {
      setError(e.response?.data?.detail || "Failed to create portfolio");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="build-page">
      {/* Progress bar */}
      <div className="build-progress">
        {steps.map((_, i) => (
          <div key={i} className={`progress-bar ${i <= step ? "active" : ""}`} />
        ))}
      </div>

      {error && <div className="build-error">{error}</div>}

      {/* Step content */}
      {currentStep === "mode" && (
        <div className="build-step">
          <h2>Build Your Portfolio</h2>
          <BuildModeSelector selected={mode} onSelect={setMode} />
        </div>
      )}

      {currentStep === "stocks" && (
        <div className="build-step">
          <h2>Select Your Stocks</h2>
          <StockPicker selected={selectedStocks} onSelect={setSelectedStocks} />
        </div>
      )}

      {currentStep === "risk" && (
        <div className="build-step">
          <h2>Your Risk Profile</h2>
          <RiskSliders sliders={sliders} onSlidersChange={setSliders}
                       refine={refine} onRefineChange={setRefine} />
        </div>
      )}

      {currentStep === "count" && (
        <div className="build-step">
          <h2>Portfolio Size</h2>
          <StockCountPicker selected={stockCount} onSelect={setStockCount} />
        </div>
      )}

      {currentStep === "profile" && (
        <div className="build-step">
          <h2>Your Profile</h2>
          <ProfileResult score={score} profile={riskProfile} />
          <div className="build-inputs">
            <div className="input-group">
              <label>Investment Amount ($)</label>
              <input type="number" min="1000" value={investmentAmount}
                     onChange={(e) => setInvestmentAmount(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label>Portfolio Name (optional)</label>
              <input value={portfolioName}
                     onChange={(e) => setPortfolioName(e.target.value)}
                     placeholder={`${riskProfile.replace(/_/g, " ")} Portfolio`} />
            </div>
          </div>
        </div>
      )}

      {currentStep === "settings" && (
        <div className="build-step">
          <h2>Optimization Settings</h2>
          <ProfileResult score={score} profile={riskProfile} />
          <OptimizeSettings method={method} onMethodChange={setMethod}
                            maxPosition={maxPosition} onMaxPositionChange={setMaxPosition}
                            stockCount={selectedStocks.length} />
          <div className="build-inputs">
            <div className="input-group">
              <label>Investment Amount ($)</label>
              <input type="number" min="1000" value={investmentAmount}
                     onChange={(e) => setInvestmentAmount(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label>Portfolio Name (optional)</label>
              <input value={portfolioName}
                     onChange={(e) => setPortfolioName(e.target.value)}
                     placeholder="Optimized Portfolio" />
            </div>
          </div>
        </div>
      )}

      {currentStep === "review" && result && (
        <div className="build-step">
          <h2>Review Your Portfolio</h2>
          <AllocationReview
            allocation={result.allocation}
            sectorBreakdown={result.sector_breakdown}
            riskMetrics={result.risk_metrics}
            onRegenerate={handleRegenerate}
            onCreate={handleCreate}
            loading={loading}
          />
        </div>
      )}

      {/* Navigation */}
      {currentStep !== "review" && (
        <div className="build-nav">
          {step > 0 && (
            <button className="btn-secondary" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button className="btn-primary" onClick={handleNext}
                  disabled={!canProceed() || loading}>
            {loading ? "Building..." : step === steps.length - 2 ? "Build Portfolio" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create PortfolioBuildPage.css**

```css
/* frontend/src/pages/PortfolioBuildPage.css */
.build-page { max-width: 900px; margin: 0 auto; padding: 24px 16px; }
.build-progress { display: flex; gap: 4px; justify-content: center; margin-bottom: 32px; }
.progress-bar { width: 48px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.12); }
.progress-bar.active { background: var(--accent); }
.build-step { min-height: 300px; }
.build-step h2 { text-align: center; margin-bottom: 24px; }
.build-error {
  background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5; padding: 10px 16px; border-radius: 8px; margin-bottom: 16px;
  text-align: center; font-size: 13px;
}
.build-nav { display: flex; gap: 12px; justify-content: center; margin-top: 32px; }
.build-nav .btn-secondary {
  padding: 10px 20px; border: 1px solid var(--border); border-radius: 8px;
  background: transparent; color: var(--text-primary); cursor: pointer;
}
.build-nav .btn-primary {
  padding: 10px 28px; background: var(--accent); border: none; border-radius: 8px;
  color: white; font-weight: 600; cursor: pointer;
}
.build-nav button:disabled { opacity: 0.5; cursor: not-allowed; }
.build-inputs { display: flex; gap: 16px; justify-content: center; margin-top: 24px; flex-wrap: wrap; }
.input-group { display: flex; flex-direction: column; gap: 4px; }
.input-group label { font-size: 12px; color: var(--text-secondary); }
.input-group input {
  padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--card-bg); color: var(--text-primary); font-size: 14px;
}
```

- [ ] **Step 3: Register route in App.jsx**

In `frontend/src/App.jsx`:

After line 40 (`const PortfolioDetailPage = ...`), add:
```jsx
const PortfolioBuildPage = lazy(() => import("./pages/PortfolioBuildPage"));
```

Reorder the existing portfolio routes so `/portfolio/build` comes BEFORE `/portfolio/:id` (otherwise `:id` matches "build"). The final order must be:
```jsx
<Route path="/portfolio" element={<PortfolioListPage />} />
<Route path="/portfolio/build" element={<PortfolioBuildPage />} />
<Route path="/portfolio/:id" element={<PortfolioDetailPage />} />
```

- [ ] **Step 4: Add "Build a Portfolio" button to PortfolioListPage**

In `frontend/src/pages/PortfolioListPage.jsx`, near the existing "Create Portfolio" button (around line 59), add a second button:

```jsx
<button className="btn-accent" onClick={() => navigate("/portfolio/build")}>
  Build a Portfolio
</button>
```

Add `import { useNavigate } from "react-router-dom";` if not already present, and `const navigate = useNavigate();` in the component.

- [ ] **Step 5: Add CTA card to DashboardPage for users with 0 portfolios**

In `frontend/src/pages/DashboardPage.jsx`, find the main content area and add a CTA card that shows when the user has no portfolios:

```jsx
{portfolios.length === 0 && (
  <div className="glass-card" style={{ textAlign: "center", padding: "32px" }}>
    <h3>Build Your First Portfolio</h3>
    <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
      Answer a few questions about your risk profile and get a diversified portfolio in minutes.
    </p>
    <button className="btn-primary" onClick={() => navigate("/portfolio/build")}>
      Get Started
    </button>
  </div>
)}
```

This requires adding portfolio fetch logic to DashboardPage if not already present, or checking the existing state.

- [ ] **Step 6: Verify frontend builds**

Run: `cd /Users/a/Desktop/stock_valuation_app/frontend && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/PortfolioBuildPage.jsx \
        frontend/src/pages/PortfolioBuildPage.css \
        frontend/src/App.jsx \
        frontend/src/pages/PortfolioListPage.jsx \
        frontend/src/pages/DashboardPage.jsx
git commit -m "feat: add PortfolioBuildPage wizard with route and entry points"
```

---

## Task 11: End-to-end smoke test

**Files:** No new files

- [ ] **Step 1: Run all backend tests**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && python3 -m pytest tests/ -v`
Expected: All tests pass (existing + new portfolio builder tests)

- [ ] **Step 2: Start backend and verify new endpoints are registered**

Run: `cd /Users/a/Desktop/stock_valuation_app/backend && python3 -c "from main import app; routes = [r.path for r in app.routes]; print('/portfolio/build' in routes, '/portfolio/optimize' in routes)"`
Expected: `True True`

- [ ] **Step 3: Verify frontend builds cleanly**

Run: `cd /Users/a/Desktop/stock_valuation_app/frontend && npm run build`
Expected: Build succeeds

- [ ] **Step 4: Final commit and push**

```bash
git push
```
