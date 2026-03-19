# Portfolio Builder — Design Spec

**Date:** 2026-03-19
**Status:** Approved
**Feature:** Risk-based portfolio creator with guided builder and manual optimizer

---

## Overview

A wizard-based portfolio builder at `/portfolio/build` with two modes:

1. **Build For Me** — Risk questionnaire → sector allocation → EVS-driven stock selection → review → create
2. **Optimize Mine** — User picks stocks → sets risk profile → system optimizes weights → review → create

Both modes produce a portfolio that is created via existing `POST /portfolio` and `POST /portfolio/{id}/holdings` endpoints. No new database tables required.

---

## Risk Profiling

### Quick Sliders (always shown)

| Slider | Range | Labels |
|--------|-------|--------|
| Risk Tolerance | 1-10 | Conservative ↔ Aggressive |
| Investment Horizon | 1-10 | 1 year ↔ 10+ years |
| Income Preference | 1-10 | Dividends ↔ Growth |

### Refine Questions (expandable, optional)

- "How would you react to a 20% portfolio drop?" → Hold / Buy more / Sell some / Sell all
- "What % of your net worth is this portfolio?" → <10% / 10-30% / 30-50% / >50%
- "Primary goal?" → Preserve capital / Steady income / Balanced growth / Maximum growth

### Score Computation

Sliders produce a base score (1-100). Refine questions adjust ±15 points. Final score maps to profile:

| Score | Profile | Optimization Method |
|-------|---------|-------------------|
| 1-20 | Conservative | Global Minimum Variance |
| 21-40 | Moderately Conservative | GMV + light EVS tilt |
| 41-60 | Moderate | Black-Litterman + EVS views |
| 61-80 | Moderately Aggressive | BL + EVS, stronger tilts |
| 81-100 | Aggressive | BL + EVS, highest concentration |

---

## Sector Allocation Templates

Each profile has a predefined sector allocation used by the guided builder. Sector names match exact values from `stock_fundamentals.sector` (FMP GICS classification):

| Sector | Conservative | Mod. Conservative | Moderate | Mod. Aggressive | Aggressive |
|--------|:-----------:|:-----------------:|:--------:|:---------------:|:----------:|
| Information Technology | 8% | 13% | 23% | 28% | 33% |
| Health Care | 14% | 14% | 14% | 11% | 11% |
| Consumer Staples | 19% | 14% | 9% | 4% | 2% |
| Utilities | 14% | 9% | 4% | 2% | 0% |
| Financials | 11% | 12% | 14% | 14% | 14% |
| Industrials | 9% | 11% | 11% | 9% | 9% |
| Energy | 7% | 7% | 7% | 5% | 5% |
| Consumer Discretionary | 5% | 6% | 5% | 10% | 10% |
| Communication Services | 5% | 6% | 5% | 9% | 9% |
| Real Estate | 5% | 5% | 5% | 5% | 4% |
| Basic Materials | 3% | 3% | 3% | 3% | 3% |

**Minimum diversification rule:** If a sector allocation results in fewer than 2 stocks, merge that sector's weight into the nearest related sector (e.g., Basic Materials → Industrials, Real Estate → Financials).

---

## Optimization Engine

Informed by the mean-variance portfolio optimization literature (Markowitz 1952 through 2026). Key design decisions driven by the literature:

### Covariance Estimation: Ledoit-Wolf Shrinkage

Never use the sample covariance matrix directly (Ledoit & Wolf 2004). The shrinkage estimator pulls extreme eigenvalues toward a structured target (constant-correlation model), producing stable, diversified weights. Implemented in ~40 lines of NumPy — no external portfolio libraries needed.

### Conservative/Mod-Conservative: Global Minimum Variance

For risk-averse profiles, expected return estimation is the most damaging input error (Chopra & Ziemba 1993 — 10x more damaging than variance errors). The GMV portfolio requires only the shrunk covariance matrix and no return estimates. EVS scores are applied as light tilts (±2-5% from GMV weights).

### Moderate through Aggressive: Black-Litterman-style EVS Views

Start from equal-weight within each sector bucket (equilibrium prior), then apply EVS scores as confidence-weighted tilts (Black & Litterman 1992). Higher EVS = stronger view that the stock deserves more weight, but tilt magnitude is bounded. This avoids the error-maximization trap of direct EVS-proportional weighting.

### Constraints as Regularizers

Hard constraints act as implicit regularizers (Jagannathan & Ma 2003):

| Constraint | Conservative | Moderate | Aggressive |
|-----------|:-----------:|:--------:|:----------:|
| Max single position | 8% | 10% | 15% |
| Min position | 1% | 1% | 1% |
| Max sector exposure | 35% | 35% | 35% |
| Short selling | No | No | No |

### HRP for Large Selections (Optimize Mine mode)

When the user selects >15 stocks in Optimize Mine mode, offer Hierarchical Risk Parity (López de Prado 2016) as an alternative. HRP clusters stocks by correlation structure and allocates risk inversely to cluster volatility — avoids matrix inversion, which amplifies estimation errors in high-dimensional settings (Jain & Jain 2019).

### Optimization Pipeline

```
Input stocks → Fetch 1yr daily returns (yfinance)
  → Compute sample covariance matrix
  → Apply Ledoit-Wolf shrinkage
  → Branch by risk profile:
      Conservative/Mod-Conservative:
          → Global Minimum Variance (shrunk Σ only)
          → Light EVS tilt (±2-5%)
      Moderate:
          → BL-style: equal-weight prior + EVS views
          → Constrained optimization (scipy SLSQP)
      Mod-Aggressive/Aggressive:
          → Stronger EVS tilts + higher concentration limits
          → Constrained optimization (scipy SLSQP)
  → Apply hard constraints (position limits, sector caps, no shorting)
  → If N > 15 and Optimize Mine: offer HRP alternative
  → Output: {ticker: weight%} allocation
```

### Stock Selection Algorithm (Build For Me)

Within each sector bucket:
1. Filter S&P 500 stocks in that sector from `stock_fundamentals`
2. Rank by EVS score (descending) from `equity_value_scores`
3. Stocks without EVS scores are placed last in ranking within their sector. If an entire sector has no EVS data, fall back to equal-weight selection of the top N stocks by market cap from `stock_fundamentals`
4. Pick top N stocks to fill user's chosen count
5. Feed into optimization pipeline above

---

## API Contracts

### `POST /portfolio/build` (Guided Builder)

Requires authentication. Enforces tier limits (Free: 1 use, Pro/Max: unlimited).

```json
// Request
{
  "risk_score": 72,
  "profile": "moderately_aggressive",
  "stock_count": "medium",
  "investment_amount": 50000,
  "name": "My Growth Portfolio"
}

// stock_count enum: "small" (5-10), "medium" (10-15), "large" (15-25)
// investment_amount: float, required, minimum 1000. Used to compute share counts.
// shares = floor(weight * investment_amount / current_price)

// Response
{
  "portfolio_id": "uuid",
  "profile": "moderately_aggressive",
  "allocation": [
    {"ticker": "AAPL", "weight": 0.08, "shares": 12, "sector": "Information Technology", "evs_score": 78}
  ],
  "sector_breakdown": {"Information Technology": 0.28, "Health Care": 0.15},
  "risk_metrics": {
    "method": "black_litterman_evs",
    "covariance": "ledoit_wolf_shrinkage",
    "expected_annual_return": 0.12,
    "expected_annual_volatility": 0.18,
    "sharpe_ratio": 0.52
  }
}
```

### `POST /portfolio/optimize` (Optimizer Mode)

Requires authentication. Pro+ only.

```json
// Request
{
  "tickers": ["AAPL", "MSFT", "JNJ", "XOM", "JPM"],
  "risk_score": 55,
  "profile": "moderate",
  "method": "mean_variance",
  "investment_amount": 50000,
  "max_position": 0.10,
  "name": "Custom Optimized"
}

// method: "mean_variance" or "hrp" (HRP offered when len(tickers) > 15)
// Response — same shape as /portfolio/build
```

---

## Backend Module

**File:** `backend/portfolio_builder.py`

Dependencies: `numpy`, `scipy>=1.12` (add to `requirements.txt`). No sklearn, no PyPortfolioOpt.

### Functions

| Function | Purpose |
|----------|---------|
| `compute_risk_profile(sliders, refine_answers)` | → `(score: int, profile: str)` |
| `get_sector_template(profile)` | → `{sector: target_weight}` |
| `select_stocks(sector_template, stock_count, evs_data)` | → `[tickers]` |
| `ledoit_wolf_shrink(returns_matrix)` | → `shrunk_covariance_matrix` |
| `optimize_min_variance(cov, constraints)` | → `weights` |
| `optimize_black_litterman_evs(cov, evs_scores, constraints)` | → `weights` |
| `optimize_hrp(returns_matrix, constraints)` | → `weights` |
| `build_portfolio(risk_score, stock_count, investment_amount)` | → `allocation` (guided mode) |
| `optimize_portfolio(tickers, risk_score, method, investment_amount)` | → `allocation` (optimizer mode) |

**Note:** The route handler (not these functions) handles portfolio creation. `build_portfolio` and `optimize_portfolio` return the allocation dict only. The route handler then calls existing `create_portfolio` + `add_holding` in a loop to persist.

---

## Frontend

### Route

```jsx
<Route path="/portfolio/build" element={<PortfolioBuildPage />} />
```

### Page

**`PortfolioBuildPage.jsx`** — Wizard container with step state management. Manages: `{mode, sliders, refineAnswers, stockCount, profile, allocation}`.

### New Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `BuildModeSelector.jsx` | `components/portfolio/` | "Build For Me" vs "Optimize Mine" cards |
| `RiskSliders.jsx` | `components/portfolio/` | 3 sliders + expandable refine section. Shared by both modes |
| `StockCountPicker.jsx` | `components/portfolio/` | 3 range options (5-10, 10-15, 15-25) |
| `ProfileResult.jsx` | `components/portfolio/` | Computed score, profile name, method info |
| `StockPicker.jsx` | `components/portfolio/` | Multi-select search (Optimize Mine mode) |
| `OptimizeSettings.jsx` | `components/portfolio/` | Method selector (MV vs HRP), max position override |
| `AllocationReview.jsx` | `components/portfolio/` | Sector donut + holdings table + risk metrics + Regenerate/Create |

### Reused Components

- `AllocationChart.jsx` — existing donut chart
- Search hook from `AddHoldingModal.jsx` — ticker autocomplete

### Entry Points

- "Build a Portfolio" button on `PortfolioListPage.jsx`
- CTA card on `DashboardPage.jsx` for users with 0 portfolios

### Wizard Steps

**Build For Me:** Mode Select → Risk Sliders → Stock Count → Profile Result → Review & Create
**Optimize Mine:** Mode Select → Stock Picker → Risk Sliders → Optimize Settings → Review & Create

---

## Tier Gating

| Feature | Free | Pro | Max |
|---------|:----:|:---:|:---:|
| Guided Builder | 1 portfolio (existing limit) | Unlimited | Unlimited |
| Optimizer (manual) | Locked | Unlimited | Unlimited |
| HRP method | Locked | Unlimited | Unlimited |

Free tier is gated by the existing portfolio limit (`PORTFOLIO_LIMITS["free"] = (1, 5)`). No new tracking column needed — if the user already has 1 portfolio, the builder is locked with an upgrade CTA.

### Input Validation

All request fields validated via Pydantic models:
- `risk_score`: int, 1-100
- `profile`: enum of 5 valid profile names
- `stock_count`: enum `"small"` | `"medium"` | `"large"`
- `investment_amount`: float, min 1000
- `tickers`: list of strings, each validated against `stock_fundamentals` (S&P 500 only)
- `method`: enum `"mean_variance"` | `"hrp"`
- `max_position`: optional float, 0.01-0.25
- `name`: string, 1-50 chars

---

## Key References

- Markowitz, H. (1952). Portfolio selection. *The Journal of Finance*, 7(1), 77-91.
- Ledoit, O., & Wolf, M. (2004). Honey, I shrunk the sample covariance matrix. *JPM*, 30(4), 110-119.
- Black, F., & Litterman, R. (1992). Global portfolio optimization. *FAJ*, 48(5), 28-43.
- Chopra, V. K., & Ziemba, W. T. (1993). The effect of errors in means, variances, and covariances. *JPM*, 19(2), 6-11.
- Jagannathan, R., & Ma, T. (2003). Risk reduction in large portfolios. *JoF*, 58(4), 1651-1683.
- López de Prado, M. (2016). Building diversified portfolios that outperform out of sample. *JPM*, 42(4), 59-69.
- DeMiguel, V., Garlappi, L., & Uppal, R. (2009). Optimal versus naive diversification. *RFS*, 22(5), 1915-1953.
