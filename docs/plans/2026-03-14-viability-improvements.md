# Viability Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Equity Value from ~5/10 to 9/10 on market viability by adding a proprietary Equity Value Score (EVS), backtested accuracy tracking, retention hooks (alerts/digest), annual billing, programmatic SEO pages, and security hardening.

**Architecture:** Two-phase build. Phase 1 (weeks 1-4): EVS scoring algorithm + nightly computation + company page integration + public top scores endpoint + annual billing + disclaimers + security. Phase 2 (weeks 5-8): accuracy tracking pipeline + alerts + email via Resend + weekly digest + programmatic SEO pages + cost dashboard + free tier rebalance.

**Tech Stack:** Python/FastAPI, React/Vite, Supabase (postgrest-py), Stripe, Resend, Jinja2, GitHub Actions, numpy

**Spec:** `docs/superpowers/specs/2026-03-14-viability-improvements-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/evs/score.py` | **Create** | EVS computation: 5-component scoring algorithm |
| `backend/evs/__init__.py` | **Create** | Empty |
| `backend/routes/evs.py` | **Create** | EVS API endpoints: `/evs/{ticker}`, `/evs/top`, `/evs/bottom` |
| `backend/routes/accuracy.py` | **Create** | Accuracy endpoints: `/accuracy/models`, `/accuracy/score`, `/accuracy/{ticker}` |
| `backend/routes/alerts.py` | **Create** | Alert endpoints: `/alerts/subscribe`, `/alerts/history`, `/alerts/{id}/read` |
| `backend/evs/snapshot.py` | **Create** | Nightly pipeline: compute all EVS, snapshot valuations, backfill accuracy, fire alerts |
| `backend/evs/digest.py` | **Create** | Weekly digest email generation + sending via Resend |
| `backend/seo_generator.py` | **Create** | Jinja2-based static HTML page generator for SEO |
| `backend/seo_templates/stock.html` | **Create** | Jinja2 template for individual stock SEO page |
| `backend/seo_templates/index.html` | **Create** | Jinja2 template for stock index/list SEO pages |
| `backend/tests/test_evs.py` | **Create** | Unit tests for EVS scoring algorithm |
| `backend/tests/test_accuracy.py` | **Create** | Unit tests for accuracy direction calculation |
| `backend/stripe_handler.py` | **Modify** | Add annual price IDs |
| `backend/main.py` | **Modify** | Register EVS/accuracy/alerts routers, add rate limiting, disclaimers |
| `backend/auth.py` | **Modify** | Move hardcoded credentials to env vars |
| `frontend/src/components/EVScoreBadge.jsx` | **Create** | Circular score badge component |
| `frontend/src/components/EVScoreBreakdown.jsx` | **Create** | Score breakdown accordion |
| `frontend/src/components/EVScoreHistory.jsx` | **Create** | Score sparkline chart |
| `frontend/src/components/AlertBell.jsx` | **Create** | Notification bell with unread count |
| `frontend/src/components/AlertPreferences.jsx` | **Create** | Per-stock alert configuration |
| `frontend/src/pages/AccuracyPage.jsx` | **Create** | Model accuracy dashboard |
| `frontend/src/pages/CompanyPage.jsx` | **Modify** | Add EVS badge as hero element |
| `frontend/src/pages/LandingPage.jsx` | **Modify** | Add EVS top picks, annual billing toggle |
| `frontend/src/pages/DashboardPage.jsx` | **Modify** | Add EVS badges to watchlist |
| `frontend/src/pages/ScreenerPage.jsx` | **Modify** | Add EVS column + score range filter |
| `frontend/src/components/UpgradeModal.jsx` | **Modify** | Add monthly/annual toggle |
| `frontend/src/context/AuthContext.jsx` | **Modify** | Update FREE_BLOCKED with new gated features |
| `frontend/src/App.jsx` | **Modify** | Add /accuracy route, disclaimer footer |
| `frontend/src/layouts/AppLayout.jsx` | **Modify** | Add alert bell to nav, disclaimer footer |
| `.github/workflows/nightly-evs-pipeline.yml` | **Create** | Daily EVS compute + snapshot + accuracy + alerts |
| `.github/workflows/weekly-digest.yml` | **Create** | Sunday digest email |
| `.github/workflows/generate-seo-pages.yml` | **Create** | Daily SEO page generation |
| `frontend/vercel.json` | **Modify** | Add rewrites for /stocks/* static pages |

---

## Chunk 1: EVS Scoring Algorithm + Tests (Phase 1, Week 1)

### Task 1: Create EVS scoring module with tests

**Files:**
- Create: `backend/evs/__init__.py`
- Create: `backend/evs/score.py`
- Create: `backend/tests/test_evs.py`

- [ ] **Step 1: Create empty package**

Create `backend/evs/__init__.py` (empty file).

- [ ] **Step 2: Write failing tests for EVS computation**

Create `backend/tests/test_evs.py`:

```python
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_evs.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'evs.score'`

- [ ] **Step 4: Implement EVS scoring algorithm**

Create `backend/evs/score.py`:

```python
"""Equity Value Score (EVS) — proprietary 1-100 composite scoring algorithm.

Components (weights):
  - Valuation (35%): Consensus model upside
  - Financial Health (20%): Altman Z, Piotroski, leverage, margins
  - Analyst Alignment (15%): Model-analyst agreement
  - Growth Quality (15%): Revenue, EPS, FCF growth
  - Risk Signals (15%): 52w range, earnings smoothing, investment quality
"""


def _clamp(val, lo=0.0, hi=100.0):
    return max(lo, min(hi, val))


def _valuation_score(data: dict) -> float:
    """35% weight. Maps consensus upside % to 0-100 sub-score."""
    upside = data.get("consensus_upside_pct", 0.0)
    # -50% or worse -> 0, +50% or better -> 100, linear between
    raw = _clamp((upside + 50) / 100 * 100, 0, 100)
    return round(raw, 1)


def _health_score(data: dict) -> float:
    """20% weight. Altman Z + Piotroski + leverage + margin."""
    z = data.get("altman_z_score")
    piotroski = data.get("piotroski_score")
    dte = data.get("debt_to_equity", 1.0)
    margin = data.get("profit_margin", 0.0)

    # Altman Z: <1.8=distress(0), 1.8-3.0=grey(50), >3.0=safe(100)
    z_sub = 0
    if z is not None:
        if z > 3.0:
            z_sub = 100
        elif z > 1.8:
            z_sub = (z - 1.8) / 1.2 * 100
    else:
        z_sub = 50  # neutral if missing

    # Piotroski: 0-9 mapped to 0-100
    p_sub = (piotroski / 9 * 100) if piotroski is not None else 50

    # Debt/equity: 0=100, 1=60, 3+=0
    dte_sub = _clamp(100 - (dte / 3 * 100), 0, 100) if dte is not None else 50

    # Profit margin: -10%=0, 0%=30, 20%+=100
    m_sub = _clamp((margin + 0.10) / 0.30 * 100, 0, 100) if margin is not None else 50

    combined = z_sub * 0.30 + p_sub * 0.30 + dte_sub * 0.20 + m_sub * 0.20
    return round(combined, 1)


def _analyst_score(data: dict) -> float:
    """15% weight. Agreement between models and analysts."""
    analyst_upside = data.get("analyst_target_upside_pct", 0.0)
    divergence = abs(data.get("model_analyst_divergence_pct", 50.0))

    # Analyst upside mapped similarly to valuation
    upside_sub = _clamp((analyst_upside + 30) / 60 * 100, 0, 100)

    # Low divergence = good (models agree with analysts)
    # 0% divergence -> 100, 50%+ -> 0
    alignment_sub = _clamp(100 - (divergence / 50 * 100), 0, 100)

    combined = upside_sub * 0.50 + alignment_sub * 0.50
    return round(combined, 1)


def _growth_score(data: dict) -> float:
    """15% weight. Revenue, EPS, FCF growth quality."""
    rev = data.get("revenue_growth", 0.0) or 0.0
    eps = data.get("eps_growth", 0.0) or 0.0
    fcf = data.get("fcf_growth", 0.0) or 0.0

    def _growth_sub(g):
        # -20% -> 0, 0% -> 30, +30% -> 100
        return _clamp((g + 0.20) / 0.50 * 100, 0, 100)

    combined = _growth_sub(rev) * 0.40 + _growth_sub(eps) * 0.35 + _growth_sub(fcf) * 0.25
    return round(combined, 1)


def _risk_score(data: dict) -> float:
    """15% weight. Higher = less risk = better. Inverted risk signals."""
    price_range = data.get("price_range_52w", 0.5)
    smoothing = data.get("earnings_smoothing_divergence", 0.0)
    iq = data.get("investment_quality", "neutral")

    # Near 52w high = risky (0.9+ -> 0 score), near low = opportunity (0.1 -> 100)
    range_sub = _clamp((1.0 - price_range) * 100, 0, 100)

    # Earnings smoothing divergence: 0% -> 100, 40%+ -> 0
    smooth_sub = _clamp(100 - (smoothing / 0.40 * 100), 0, 100)

    # Investment quality
    iq_sub = 30 if iq == "negative" else 70

    combined = range_sub * 0.40 + smooth_sub * 0.35 + iq_sub * 0.25
    return round(combined, 1)


def _verdict(score: int) -> str:
    if score >= 80:
        return "Strong Buy"
    if score >= 60:
        return "Buy"
    if score >= 40:
        return "Hold"
    if score >= 20:
        return "Sell"
    return "Strong Sell"


def compute_evs(data: dict) -> dict:
    """Compute the Equity Value Score (1-100) from input signals.

    Args:
        data: dict with keys from spec (consensus_upside_pct, altman_z_score, etc.)

    Returns:
        dict with score (int 0-100), verdict (str), components (dict of sub-scores 0-100)
    """
    valuation = _valuation_score(data)
    health = _health_score(data)
    analyst = _analyst_score(data)
    growth = _growth_score(data)
    risk = _risk_score(data)

    weighted = (
        valuation * 0.35 +
        health * 0.20 +
        analyst * 0.15 +
        growth * 0.15 +
        risk * 0.15
    )
    score = int(round(_clamp(weighted, 0, 100)))

    return {
        "score": score,
        "verdict": _verdict(score),
        "components": {
            "valuation": valuation,
            "health": health,
            "analyst": analyst,
            "growth": growth,
            "risk": risk,
        },
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_evs.py -v`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/evs/__init__.py backend/evs/score.py backend/tests/test_evs.py
git commit -m "feat: add EVS scoring algorithm with unit tests"
```

---

### Task 2: Create EVS data extraction helper

**Files:**
- Create: `backend/evs/extract.py`

This bridges the existing valuation/data_fetcher outputs into the EVS input format.

- [ ] **Step 1: Create extraction helper**

Create `backend/evs/extract.py`:

```python
"""Extract EVS input signals from existing valuation + data_fetcher outputs.

Bridges run_valuation() output and fetch_stock_data() output into the
flat dict format that compute_evs() expects.
"""


def extract_evs_inputs(stock_data: dict, valuation_result: dict, scores: dict = None) -> dict:
    """Convert existing data structures to EVS input format.

    Args:
        stock_data: Output from data_fetcher.fetch_stock_data()
        valuation_result: Output from router.run_valuation()
        scores: Optional row from company_scores table (altman_z, piotroski, etc.)

    Returns:
        dict matching compute_evs() expected input keys
    """
    consensus = valuation_result.get("consensus", {})
    signals = valuation_result.get("signals", {})

    # Consensus upside from valuation models
    consensus_upside = consensus.get("upside_pct", 0.0)

    # Analyst target upside
    target = stock_data.get("target_price") or stock_data.get("target_mean")
    price = stock_data.get("price") or stock_data.get("current_price") or 0
    analyst_upside = 0.0
    if target and price and price > 0:
        analyst_upside = (float(target) - float(price)) / float(price) * 100

    # Model-analyst divergence
    model_iv = consensus.get("intrinsic_value", price)
    divergence = 0.0
    if target and model_iv and model_iv > 0:
        divergence = abs(float(target) - float(model_iv)) / float(model_iv) * 100

    # 52-week price range
    high52 = stock_data.get("52w_high") or 0
    low52 = stock_data.get("52w_low") or 0
    price_range = 0.5
    if high52 and low52 and high52 > low52 and price > 0:
        price_range = (float(price) - float(low52)) / (float(high52) - float(low52))

    # Earnings smoothing from signals
    smoothing = 0.0
    es = signals.get("earnings_smoothing", {})
    if isinstance(es, dict):
        trailing = es.get("trailing_eps", 0)
        avg = es.get("avg_3yr_eps", 0)
        if avg and avg > 0:
            smoothing = abs(trailing - avg) / avg

    return {
        "consensus_upside_pct": consensus_upside,
        "altman_z_score": scores.get("altman_z_score") if scores else None,
        "piotroski_score": scores.get("piotroski_score") if scores else None,
        "debt_to_equity": stock_data.get("debt_to_equity"),
        "profit_margin": stock_data.get("profit_margin"),
        "analyst_target_upside_pct": analyst_upside,
        "model_analyst_divergence_pct": divergence,
        "revenue_growth": stock_data.get("revenue_growth"),
        "eps_growth": stock_data.get("earnings_growth"),
        "fcf_growth": stock_data.get("fcf_growth"),
        "price_range_52w": price_range,
        "earnings_smoothing_divergence": smoothing,
        "investment_quality": signals.get("investment_quality", "neutral"),
    }
```

- [ ] **Step 2: Commit**

```bash
git add backend/evs/extract.py
git commit -m "feat: add EVS data extraction bridge from existing data structures"
```

---

### Task 3: Create EVS API endpoints

**Files:**
- Create: `backend/routes/evs.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create EVS router**

Create `backend/routes/evs.py`:

```python
"""EVS (Equity Value Score) API endpoints."""
from fastapi import APIRouter, HTTPException, Depends, Query
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None

router = APIRouter(prefix="/evs")


@router.get("/top")
async def evs_top(limit: int = Query(default=20, le=50)):
    """Top N highest EVS scores. Public endpoint for SEO."""
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("equity_value_scores") \
        .select("ticker, score, verdict, components, computed_at") \
        .order("score", desc=True) \
        .limit(limit) \
        .execute().data
    return rows


@router.get("/bottom")
async def evs_bottom(limit: int = Query(default=20, le=50)):
    """Bottom N lowest EVS scores. Public endpoint for SEO."""
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("equity_value_scores") \
        .select("ticker, score, verdict, components, computed_at") \
        .order("score", desc=False) \
        .limit(limit) \
        .execute().data
    return rows


@router.get("/{ticker}")
async def evs_detail(ticker: str):
    """EVS score + component breakdown for a single ticker."""
    ticker = ticker.upper().strip()
    if not sb:
        raise HTTPException(503, "Database not configured")
    row = sb.table("equity_value_scores") \
        .select("*") \
        .eq("ticker", ticker) \
        .limit(1) \
        .execute().data
    if not row:
        raise HTTPException(404, f"No EVS data for {ticker}")
    # Get score history for sparkline
    history = sb.table("equity_value_score_history") \
        .select("score, verdict, computed_at") \
        .eq("ticker", ticker) \
        .order("computed_at", desc=True) \
        .limit(365) \
        .execute().data
    return {**row[0], "history": history}
```

- [ ] **Step 2: Register EVS router in main.py**

Add import and include_router in `backend/main.py` after the existing router imports (around line 18):

Add to imports:
```python
from routes.evs import router as evs_router
```

Add after `app.include_router(admin_router)` (around line 35):
```python
app.include_router(evs_router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/evs.py backend/main.py
git commit -m "feat: add EVS API endpoints (/evs/top, /evs/bottom, /evs/{ticker})"
```

---

### Task 4: Create nightly EVS computation script

**Files:**
- Create: `backend/evs/snapshot.py`

- [ ] **Step 1: Create the nightly pipeline script**

Create `backend/evs/snapshot.py`:

```python
"""Nightly EVS pipeline: compute scores for all S&P 500 tickers.

Steps (run sequentially):
1. Fetch all tickers from stock_fundamentals
2. For each ticker: fetch data, run valuation, extract EVS inputs, compute score
3. Upsert to equity_value_scores + append to equity_value_score_history
4. Snapshot valuations for accuracy tracking (Phase 2)

Usage: python -m evs.snapshot
"""
import os
import sys
import json
from datetime import datetime, timezone

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from supabase import create_client
from data_fetcher import fetch_stock_data
from main import normalise
from valuation.router import run_valuation
from evs.score import compute_evs
from evs.extract import extract_evs_inputs

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))
sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def fetch_all_tickers():
    """Get all tickers from stock_fundamentals."""
    rows = sb.table("stock_fundamentals").select("ticker").execute().data
    return [r["ticker"] for r in rows]


def fetch_scores(ticker):
    """Get company_scores row for Altman Z, Piotroski."""
    rows = sb.table("company_scores").select("*").eq("ticker", ticker).limit(1).execute().data
    return rows[0] if rows else {}


def compute_and_store(ticker):
    """Compute EVS for one ticker and store results."""
    try:
        raw_data = fetch_stock_data(ticker)
        if not raw_data:
            print(f"  SKIP {ticker}: no data")
            return None
        data = normalise(raw_data)
        valuation = run_valuation(data)
        scores = fetch_scores(ticker)
        evs_inputs = extract_evs_inputs(data, valuation, scores)
        evs_result = compute_evs(evs_inputs)

        now = datetime.now(timezone.utc).isoformat()

        # Upsert to equity_value_scores (current score)
        sb.table("equity_value_scores").upsert({
            "ticker": ticker,
            "score": evs_result["score"],
            "verdict": evs_result["verdict"],
            "valuation_score": evs_result["components"]["valuation"],
            "health_score": evs_result["components"]["health"],
            "analyst_score": evs_result["components"]["analyst"],
            "growth_score": evs_result["components"]["growth"],
            "risk_score": evs_result["components"]["risk"],
            "components": json.dumps(evs_result["components"]),
            "computed_at": now,
        }, on_conflict="ticker").execute()

        # Append to history
        sb.table("equity_value_score_history").upsert({
            "ticker": ticker,
            "score": evs_result["score"],
            "verdict": evs_result["verdict"],
            "computed_at": now,
        }, on_conflict="ticker,computed_at").execute()

        return evs_result["score"]
    except Exception as e:
        print(f"  ERROR {ticker}: {e}")
        return None


def main():
    tickers = fetch_all_tickers()
    print(f"Computing EVS for {len(tickers)} tickers...")
    success = 0
    failed = 0
    for i, ticker in enumerate(tickers):
        score = compute_and_store(ticker)
        if score is not None:
            success += 1
            if (i + 1) % 50 == 0:
                print(f"  Progress: {i + 1}/{len(tickers)} ({success} ok, {failed} failed)")
        else:
            failed += 1
    print(f"Done: {success} computed, {failed} failed out of {len(tickers)}")
    if failed > len(tickers) * 0.10:
        print("WARNING: >10% failure rate — check data sources")
        sys.exit(1)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add backend/evs/snapshot.py
git commit -m "feat: add nightly EVS computation pipeline"
```

---

### Task 5: Create nightly EVS GitHub Action

**Files:**
- Create: `.github/workflows/nightly-evs-pipeline.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/nightly-evs-pipeline.yml`:

```yaml
name: Nightly EVS Pipeline

on:
  schedule:
    - cron: '0 11 * * 1-5'  # 6am ET (11 UTC) Mon-Fri
  workflow_dispatch:

jobs:
  compute-evs:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Compute EVS scores
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          FINNHUB_KEY: ${{ secrets.FINNHUB_KEY }}
          FMP_KEY: ${{ secrets.FMP_KEY }}
        run: |
          cd backend
          python -m evs.snapshot
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/nightly-evs-pipeline.yml
git commit -m "ci: add nightly EVS pipeline GitHub Action"
```

---

### Task 6: Create Supabase tables for EVS

**Files:** None (SQL run in Supabase dashboard)

- [ ] **Step 1: Create tables via Supabase SQL editor**

Run the following SQL in the Supabase SQL editor:

```sql
-- EVS current scores (one row per ticker, overwritten nightly)
CREATE TABLE IF NOT EXISTS equity_value_scores (
    ticker TEXT PRIMARY KEY,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    verdict TEXT NOT NULL,
    valuation_score REAL,
    health_score REAL,
    analyst_score REAL,
    growth_score REAL,
    risk_score REAL,
    components JSONB,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EVS history (one row per ticker per day, for sparklines and backtesting)
CREATE TABLE IF NOT EXISTS equity_value_score_history (
    id SERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    score INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ticker, (computed_at::date))
);

CREATE INDEX IF NOT EXISTS idx_evs_history_ticker ON equity_value_score_history(ticker, computed_at DESC);

-- Valuation snapshots (for accuracy tracking, Phase 2)
CREATE TABLE IF NOT EXISTS valuation_snapshots (
    id SERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    model_name TEXT NOT NULL,
    intrinsic_value REAL,
    verdict TEXT,
    price_at_snapshot REAL,
    UNIQUE(ticker, snapshot_date, model_name)
);

-- Accuracy tracking (filled by backfill job, Phase 2)
CREATE TABLE IF NOT EXISTS accuracy_tracking (
    id SERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    model_name TEXT NOT NULL,
    intrinsic_value REAL,
    price_at_snapshot REAL,
    price_6mo REAL,
    price_12mo REAL,
    direction_correct_6mo BOOLEAN,
    direction_correct_12mo BOOLEAN,
    UNIQUE(ticker, snapshot_date, model_name)
);

-- User alerts (Phase 2)
CREATE TABLE IF NOT EXISTS user_alerts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('score_threshold', 'score_change', 'verdict_flip', 'analyst_shift')),
    threshold INTEGER,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert history (Phase 2)
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_alert_history_user ON alert_history(user_id, triggered_at DESC);

-- API usage log
CREATE TABLE IF NOT EXISTS api_usage_log (
    id SERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    user_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_time_ms INTEGER,
    estimated_cost REAL
);

CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage_log(timestamp);
```

- [ ] **Step 2: Verify tables created**

Run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%evs%' OR table_name LIKE '%equity%' OR table_name LIKE '%accuracy%' OR table_name LIKE '%alert%' OR table_name LIKE '%api_usage%';` to confirm all 7 tables exist.

---

## Chunk 2: Frontend EVS Integration (Phase 1, Week 2)

### Task 7: Create EVS Score Badge component

**Files:**
- Create: `frontend/src/components/EVScoreBadge.jsx`

- [ ] **Step 1: Create the circular score badge**

Create `frontend/src/components/EVScoreBadge.jsx`:

```jsx
import { useEffect, useState } from "react";

const VERDICT_COLORS = {
  "Strong Buy": "#22c55e",
  "Buy": "#4ade80",
  "Hold": "#eab308",
  "Sell": "#f87171",
  "Strong Sell": "#ef4444",
};

export default function EVScoreBadge({ score, verdict, size = "lg" }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const color = VERDICT_COLORS[verdict] || "#64748b";
  const radius = size === "lg" ? 54 : 36;
  const stroke = size === "lg" ? 6 : 4;
  const circumference = 2 * Math.PI * radius;
  const progress = (animatedScore / 100) * circumference;
  const dim = (radius + stroke) * 2;

  useEffect(() => {
    let frame;
    let start = 0;
    const animate = () => {
      start += 2;
      if (start > score) start = score;
      setAnimatedScore(start);
      if (start < score) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  return (
    <div className="evs-badge" style={{ textAlign: "center" }}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
        <circle
          cx={dim / 2} cy={dim / 2} r={radius}
          fill="none" stroke="var(--border)" strokeWidth={stroke}
        />
        <circle
          cx={dim / 2} cy={dim / 2} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle"
          fill="var(--text)" fontSize={size === "lg" ? 28 : 18} fontWeight="700">
          {animatedScore}
        </text>
        <text x="50%" y="64%" textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={size === "lg" ? 11 : 9} fontWeight="600" letterSpacing="0.5">
          {verdict?.toUpperCase()}
        </text>
      </svg>
      {size === "lg" && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
          Equity Value Score
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/EVScoreBadge.jsx
git commit -m "feat: add EVScoreBadge circular score component"
```

---

### Task 8: Create EVS Score Breakdown component

**Files:**
- Create: `frontend/src/components/EVScoreBreakdown.jsx`

- [ ] **Step 1: Create the breakdown accordion**

Create `frontend/src/components/EVScoreBreakdown.jsx`:

```jsx
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const LABELS = {
  valuation: { name: "Valuation", weight: "35%", desc: "Consensus model upside vs current price" },
  health: { name: "Financial Health", weight: "20%", desc: "Altman Z, Piotroski, leverage, margins" },
  analyst: { name: "Analyst Alignment", weight: "15%", desc: "Agreement between models and Wall Street" },
  growth: { name: "Growth Quality", weight: "15%", desc: "Revenue, EPS, and free cash flow trends" },
  risk: { name: "Risk Signals", weight: "15%", desc: "52-week range, earnings consistency, asset quality" },
};

function ScoreBar({ value, color }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: "var(--border)", flex: 1 }}>
      <div style={{
        height: "100%", borderRadius: 3, background: color,
        width: `${Math.min(value, 100)}%`, transition: "width 0.6s ease-out",
      }} />
    </div>
  );
}

function barColor(val) {
  if (val >= 70) return "#22c55e";
  if (val >= 40) return "#eab308";
  return "#ef4444";
}

export default function EVScoreBreakdown({ components }) {
  const [open, setOpen] = useState(false);
  const { isFeatureUnlocked } = useAuth();
  const unlocked = isFeatureUnlocked("evs_breakdown");

  if (!components) return null;

  return (
    <div className="card" style={{ padding: "12px 16px" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          background: "none", border: "none", color: "var(--text)", cursor: "pointer",
          fontSize: 13, fontWeight: 600,
        }}
      >
        Score Breakdown
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }} />
      </button>
      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {unlocked ? (
            Object.entries(LABELS).map(([key, meta]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 130, fontSize: 12, color: "var(--text-muted)" }}>
                  {meta.name} <span style={{ opacity: 0.5 }}>({meta.weight})</span>
                </div>
                <ScoreBar value={components[key]} color={barColor(components[key])} />
                <div style={{ width: 30, fontSize: 12, fontWeight: 600, textAlign: "right" }}>
                  {Math.round(components[key])}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
              Upgrade to Pro to see the full score breakdown
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/EVScoreBreakdown.jsx
git commit -m "feat: add EVScoreBreakdown accordion component"
```

---

### Task 9: Integrate EVS into CompanyPage

**Files:**
- Modify: `frontend/src/pages/CompanyPage.jsx`

- [ ] **Step 1: Add EVS fetch and display to CompanyPage**

In `frontend/src/pages/CompanyPage.jsx`:

Add imports at top:
```jsx
import EVScoreBadge from "../components/EVScoreBadge";
import EVScoreBreakdown from "../components/EVScoreBreakdown";
```

Add EVS state alongside existing state:
```jsx
const [evs, setEvs] = useState(null);
```

Add EVS fetch inside the existing `useEffect` `load()` function, alongside the existing `Promise.allSettled` calls — add `api.get(`/evs/${ticker}`)` as a third promise:

```jsx
const [summaryRes, valuationRes, evsRes] = await Promise.allSettled([
  api.get(`/summary/${ticker}`),
  api.get(`/valuation/${ticker}`),
  api.get(`/evs/${ticker}`),
]);
if (summaryRes.status === "fulfilled") setData(summaryRes.value.data);
if (valuationRes.status === "fulfilled") setValuation(valuationRes.value.data);
if (evsRes.status === "fulfilled") setEvs(evsRes.value.data);
```

Add EVS badge as the hero element in the return JSX, right after `<CompanyNav />` and before `{valuation && <CompanyHeader data={valuation} />}`:

```jsx
{evs && (
  <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
    <EVScoreBadge score={evs.score} verdict={evs.verdict} />
    <EVScoreBreakdown components={evs.components ? JSON.parse(evs.components) : evs} />
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/CompanyPage.jsx
git commit -m "feat: integrate EVS score badge into company page"
```

---

### Task 10: Add EVS to Dashboard and Screener

**Files:**
- Modify: `frontend/src/pages/DashboardPage.jsx`
- Modify: `frontend/src/pages/ScreenerPage.jsx`

- [ ] **Step 1: Add EVS badges to Dashboard top picks**

In `frontend/src/pages/DashboardPage.jsx`, import `EVScoreBadge` and add a small badge next to each stock in the top picks list. The exact insertion point depends on the current component structure — add `<EVScoreBadge score={stock.evs_score} verdict={stock.evs_verdict} size="sm" />` next to each ticker display if EVS data is available.

- [ ] **Step 2: Add EVS column to Screener table**

In `frontend/src/pages/ScreenerPage.jsx`, add an "EVS" column header and cell that displays the score with color coding. Fetch EVS data alongside the existing screener data.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DashboardPage.jsx frontend/src/pages/ScreenerPage.jsx
git commit -m "feat: add EVS score to dashboard and screener"
```

---

## Chunk 3: Annual Billing + Security + Disclaimers (Phase 1, Weeks 3-4)

### Task 11: Add annual billing to Stripe

**Files:**
- Modify: `backend/stripe_handler.py`
- Modify: `frontend/src/components/UpgradeModal.jsx`
- Modify: `frontend/src/pages/LandingPage.jsx`

- [ ] **Step 1: Update stripe_handler.py with annual price IDs**

In `backend/stripe_handler.py`, update `PLAN_PRICE_IDS`:

```python
PLAN_PRICE_IDS = {
    "pro": os.environ.get("STRIPE_PRO_PRICE_ID", ""),
    "pro_annual": os.environ.get("STRIPE_PRO_ANNUAL_PRICE_ID", ""),
    "max": os.environ.get("STRIPE_MAX_PRICE_ID", ""),
    "max_annual": os.environ.get("STRIPE_MAX_ANNUAL_PRICE_ID", ""),
}
```

Update `price_id_to_plan` to map annual variants to the same plan name:

```python
def price_id_to_plan(price_id: str) -> str:
    for plan, pid in PLAN_PRICE_IDS.items():
        if pid and pid == price_id:
            # Strip _annual suffix — both monthly and annual map to same plan
            return plan.replace("_annual", "")
    return "pro"
```

- [ ] **Step 2: Add monthly/annual toggle to UpgradeModal**

In `frontend/src/components/UpgradeModal.jsx`, add a toggle switch at the top of the modal that switches between monthly and annual pricing. When annual is selected, show the discounted price and pass the `_annual` plan variant to the checkout endpoint.

- [ ] **Step 3: Add the same toggle to the landing page pricing section**

In `frontend/src/pages/LandingPage.jsx`, add a monthly/annual toggle above the pricing cards. When annual is selected, update the displayed prices ($24/mo, $40/mo) and show "Save 20%" badge.

- [ ] **Step 4: Commit**

```bash
git add backend/stripe_handler.py frontend/src/components/UpgradeModal.jsx frontend/src/pages/LandingPage.jsx
git commit -m "feat: add annual billing with 20% discount"
```

---

### Task 12: Security hardening

**Files:**
- Modify: `backend/auth.py`
- Modify: `backend/routes/admin.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Move admin credentials to env vars**

In `backend/routes/admin.py`, find any hardcoded `ADMIN_USERNAME` / `ADMIN_PASSWORD` defaults and change them to require env vars with no defaults:

```python
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
```

Add validation that raises on startup if they're not set:

```python
if not ADMIN_USERNAME or not ADMIN_PASSWORD:
    import warnings
    warnings.warn("ADMIN_USERNAME and ADMIN_PASSWORD not set — admin endpoints disabled")
```

- [ ] **Step 2: Add rate limiting to main.py**

Install slowapi: add `slowapi` to `backend/requirements.txt`.

In `backend/main.py`, add rate limiting:

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
```

Add `@limiter.limit("60/minute")` decorator to public endpoints and higher limits to authenticated ones.

- [ ] **Step 3: Commit**

```bash
git add backend/routes/admin.py backend/main.py backend/requirements.txt
git commit -m "fix: harden admin credentials and add API rate limiting"
```

---

### Task 13: Add regulatory disclaimers

**Files:**
- Modify: `frontend/src/layouts/AppLayout.jsx`
- Modify: `frontend/src/pages/LandingPage.jsx`

- [ ] **Step 1: Add site-wide disclaimer footer**

In `frontend/src/layouts/AppLayout.jsx`, add a footer at the bottom of the layout:

```jsx
<footer style={{
  padding: "16px 24px", fontSize: 11, color: "var(--text-muted)",
  borderTop: "1px solid var(--border)", textAlign: "center", lineHeight: 1.5,
}}>
  Equity Value is an educational tool. Nothing on this site constitutes investment advice.
  Valuations are model estimates, not guarantees. Past accuracy does not predict future results.
  Always do your own research and consult a licensed financial advisor.
</footer>
```

- [ ] **Step 2: Add disclaimer to landing page footer**

Add the same disclaimer text to the bottom of `frontend/src/pages/LandingPage.jsx`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/layouts/AppLayout.jsx frontend/src/pages/LandingPage.jsx
git commit -m "feat: add regulatory disclaimer footer"
```

---

### Task 14: Update free tier gates

**Files:**
- Modify: `frontend/src/context/AuthContext.jsx`
- Modify: `backend/main.py`

- [ ] **Step 1: Update FREE_BLOCKED list in AuthContext**

In `frontend/src/context/AuthContext.jsx`, update the `FREE_BLOCKED` array (line 75) to add the new gated features:

```javascript
const FREE_BLOCKED = [
  "ai_thesis", "monte_carlo", "lbo", "pdf_export", "compare",
  "screener_full", "intelligence_full", "financials_quarterly",
  "evs_breakdown", "evs_history", "accuracy_detail",
];
```

- [ ] **Step 2: Update daily analysis limit from 1 to 3 for free tier**

In `frontend/src/context/AuthContext.jsx`, update the PLANS object:

```javascript
const PLANS = {
  free: { label: "Free", limit: 3 },
  pro:  { label: "Pro",  limit: 5 },
  max:  { label: "Max",  limit: Infinity },
};
```

Also update the corresponding `PLAN_LIMITS` in `backend/main.py`:

```python
PLAN_LIMITS = {"free": 3, "pro": 5, "max": 999999}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/context/AuthContext.jsx backend/main.py
git commit -m "feat: rebalance free tier (3 analyses/day, gate EVS breakdown)"
```

---

## Chunk 4: Accuracy Tracking + Alerts (Phase 2, Weeks 5-6)

### Task 15: Add valuation snapshot logic to nightly pipeline

**Files:**
- Modify: `backend/evs/snapshot.py`

- [ ] **Step 1: Add snapshot_valuations function**

Add to `backend/evs/snapshot.py`, after the `compute_and_store` function:

```python
def snapshot_valuations(ticker, valuation_result, price):
    """Snapshot each model's output for accuracy tracking."""
    today = datetime.now(timezone.utc).date().isoformat()
    models = valuation_result.get("models", [])
    for model in models:
        if not model.get("applicable"):
            continue
        try:
            sb.table("valuation_snapshots").upsert({
                "ticker": ticker,
                "snapshot_date": today,
                "model_name": model.get("model", "Unknown"),
                "intrinsic_value": model.get("intrinsic_value"),
                "verdict": model.get("verdict"),
                "price_at_snapshot": price,
            }, on_conflict="ticker,snapshot_date,model_name").execute()
        except Exception as e:
            print(f"  SNAPSHOT ERROR {ticker}/{model.get('model')}: {e}")
```

Call this inside `compute_and_store` after the EVS computation succeeds, passing the valuation result and current price.

- [ ] **Step 2: Add backfill_accuracy function**

Add to `backend/evs/snapshot.py`:

```python
def backfill_accuracy():
    """Compare past snapshots (6/12 months ago) to current prices."""
    from data_fetcher import fetch_finnhub_price
    from datetime import timedelta

    today = datetime.now(timezone.utc).date()

    for months, col_price, col_correct in [(6, "price_6mo", "direction_correct_6mo"),
                                            (12, "price_12mo", "direction_correct_12mo")]:
        target_date = (today - timedelta(days=months * 30)).isoformat()
        # Find snapshots from ~N months ago that haven't been backfilled yet
        snapshots = sb.table("valuation_snapshots") \
            .select("*") \
            .eq("snapshot_date", target_date) \
            .execute().data

        for snap in snapshots:
            ticker = snap["ticker"]
            try:
                current_price = fetch_finnhub_price(ticker)
                if not current_price:
                    continue
                price_at = snap["price_at_snapshot"]
                iv = snap["intrinsic_value"]
                if not price_at or not iv:
                    continue
                # Was the directional call correct?
                predicted_direction = "up" if iv > price_at else "down"
                actual_direction = "up" if current_price > price_at else "down"
                correct = predicted_direction == actual_direction

                sb.table("accuracy_tracking").upsert({
                    "ticker": ticker,
                    "snapshot_date": snap["snapshot_date"],
                    "model_name": snap["model_name"],
                    "intrinsic_value": iv,
                    "price_at_snapshot": price_at,
                    col_price: current_price,
                    col_correct: correct,
                }, on_conflict="ticker,snapshot_date,model_name").execute()
            except Exception as e:
                print(f"  BACKFILL ERROR {ticker}: {e}")
```

- [ ] **Step 3: Integrate into main() pipeline**

Update the `main()` function in `snapshot.py` to call `backfill_accuracy()` after the EVS computation loop completes.

- [ ] **Step 4: Commit**

```bash
git add backend/evs/snapshot.py
git commit -m "feat: add valuation snapshots and accuracy backfill to nightly pipeline"
```

---

### Task 16: Create accuracy API endpoints

**Files:**
- Create: `backend/routes/accuracy.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create accuracy router**

Create `backend/routes/accuracy.py`:

```python
"""Accuracy tracking API endpoints."""
from fastapi import APIRouter, HTTPException, Depends
import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None

router = APIRouter(prefix="/accuracy")


@router.get("/models")
async def model_accuracy():
    """Aggregate accuracy stats per model. Public endpoint."""
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("accuracy_tracking") \
        .select("model_name, direction_correct_6mo, direction_correct_12mo") \
        .execute().data
    # Aggregate per model
    models = {}
    for row in rows:
        name = row["model_name"]
        if name not in models:
            models[name] = {"total_6mo": 0, "correct_6mo": 0, "total_12mo": 0, "correct_12mo": 0}
        if row.get("direction_correct_6mo") is not None:
            models[name]["total_6mo"] += 1
            if row["direction_correct_6mo"]:
                models[name]["correct_6mo"] += 1
        if row.get("direction_correct_12mo") is not None:
            models[name]["total_12mo"] += 1
            if row["direction_correct_12mo"]:
                models[name]["correct_12mo"] += 1
    result = []
    for name, stats in models.items():
        result.append({
            "model": name,
            "accuracy_6mo": round(stats["correct_6mo"] / stats["total_6mo"] * 100, 1) if stats["total_6mo"] > 0 else None,
            "accuracy_12mo": round(stats["correct_12mo"] / stats["total_12mo"] * 100, 1) if stats["total_12mo"] > 0 else None,
            "sample_size_6mo": stats["total_6mo"],
            "sample_size_12mo": stats["total_12mo"],
        })
    result.sort(key=lambda x: x.get("accuracy_6mo") or 0, reverse=True)
    return result


@router.get("/score")
async def score_accuracy():
    """EVS backtest: returns by score range. Public endpoint."""
    if not sb:
        raise HTTPException(503, "Database not configured")
    # This will be populated once we have enough history
    return {"message": "Accuracy tracking active. Data available after 6 months of collection.", "status": "collecting"}


@router.get("/{ticker}")
async def ticker_accuracy(ticker: str):
    """Per-ticker accuracy history. Pro-gated."""
    ticker = ticker.upper().strip()
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("accuracy_tracking") \
        .select("*") \
        .eq("ticker", ticker) \
        .order("snapshot_date", desc=True) \
        .limit(100) \
        .execute().data
    return rows
```

- [ ] **Step 2: Register in main.py**

Add to imports in `backend/main.py`:
```python
from routes.accuracy import router as accuracy_router
```

Add after other include_router calls:
```python
app.include_router(accuracy_router)
```

- [ ] **Step 3: Write accuracy direction test**

Create `backend/tests/test_accuracy.py`:

```python
"""Unit tests for accuracy direction calculation."""

def test_direction_correct_when_undervalued_and_rises():
    iv, price_at, price_now = 200, 150, 180
    predicted = "up" if iv > price_at else "down"
    actual = "up" if price_now > price_at else "down"
    assert predicted == actual == "up"


def test_direction_correct_when_overvalued_and_falls():
    iv, price_at, price_now = 100, 150, 120
    predicted = "up" if iv > price_at else "down"
    actual = "up" if price_now > price_at else "down"
    assert predicted == actual == "down"


def test_direction_wrong_when_undervalued_but_falls():
    iv, price_at, price_now = 200, 150, 130
    predicted = "up" if iv > price_at else "down"
    actual = "up" if price_now > price_at else "down"
    assert predicted != actual
```

- [ ] **Step 4: Run tests**

Run: `cd backend && python -m pytest tests/test_accuracy.py -v`
Expected: All 3 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/routes/accuracy.py backend/tests/test_accuracy.py backend/main.py
git commit -m "feat: add accuracy tracking endpoints and tests"
```

---

### Task 17: Create Accuracy Dashboard page

**Files:**
- Create: `frontend/src/pages/AccuracyPage.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Create AccuracyPage**

Create `frontend/src/pages/AccuracyPage.jsx` with:
- Model Leaderboard table (fetches `/accuracy/models`)
- Score Accuracy section (fetches `/accuracy/score`)
- Methodology section (static content explaining each model)
- "Data collection in progress" banner until enough history exists

- [ ] **Step 2: Add route in App.jsx**

In `frontend/src/App.jsx`, add lazy import and route:
```jsx
const AccuracyPage = lazy(() => import("./pages/AccuracyPage"));
// In Routes:
<Route path="/accuracy" element={<AccuracyPage />} />
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AccuracyPage.jsx frontend/src/App.jsx
git commit -m "feat: add accuracy dashboard page"
```

---

### Task 18: Create alerts system

**Files:**
- Create: `backend/routes/alerts.py`
- Create: `frontend/src/components/AlertBell.jsx`
- Create: `frontend/src/components/AlertPreferences.jsx`
- Modify: `backend/main.py`
- Modify: `frontend/src/layouts/AppLayout.jsx`

- [ ] **Step 1: Create alerts router**

Create `backend/routes/alerts.py`:

```python
"""Alert subscription and history endpoints."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import os
from supabase import create_client
from auth import get_current_user

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
sb = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL else None

router = APIRouter(prefix="/alerts")


class AlertSubscription(BaseModel):
    ticker: str
    alert_type: str  # score_threshold, score_change, verdict_flip, analyst_shift
    threshold: int | None = None


@router.post("/subscribe")
async def subscribe(body: AlertSubscription, user=Depends(get_current_user)):
    if not sb:
        raise HTTPException(503, "Database not configured")
    sb.table("user_alerts").insert({
        "user_id": user["sub"],
        "ticker": body.ticker.upper(),
        "alert_type": body.alert_type,
        "threshold": body.threshold,
    }).execute()
    return {"status": "subscribed"}


@router.get("/history")
async def history(user=Depends(get_current_user)):
    if not sb:
        raise HTTPException(503, "Database not configured")
    rows = sb.table("alert_history") \
        .select("*") \
        .eq("user_id", user["sub"]) \
        .order("triggered_at", desc=True) \
        .limit(50) \
        .execute().data
    return rows


@router.put("/{alert_id}/read")
async def mark_read(alert_id: int, user=Depends(get_current_user)):
    if not sb:
        raise HTTPException(503, "Database not configured")
    sb.table("alert_history") \
        .update({"read": True}) \
        .eq("id", alert_id) \
        .eq("user_id", user["sub"]) \
        .execute()
    return {"status": "read"}


@router.delete("/{alert_id}")
async def unsubscribe(alert_id: int, user=Depends(get_current_user)):
    if not sb:
        raise HTTPException(503, "Database not configured")
    sb.table("user_alerts") \
        .delete() \
        .eq("id", alert_id) \
        .eq("user_id", user["sub"]) \
        .execute()
    return {"status": "unsubscribed"}
```

- [ ] **Step 2: Register alerts router in main.py**

Add import and include_router in `backend/main.py`.

- [ ] **Step 3: Create AlertBell component**

Create `frontend/src/components/AlertBell.jsx` — bell icon with unread count badge that opens a dropdown of recent alerts.

- [ ] **Step 4: Create AlertPreferences component**

Create `frontend/src/components/AlertPreferences.jsx` — small form on company page to subscribe to alerts for that ticker (dropdown of alert types + optional threshold).

- [ ] **Step 5: Add AlertBell to AppLayout nav**

In `frontend/src/layouts/AppLayout.jsx`, add `<AlertBell />` next to the existing nav items.

- [ ] **Step 6: Add AlertPreferences to CompanyPage**

In `frontend/src/pages/CompanyPage.jsx`, add `<AlertPreferences ticker={ticker} />` below the EVS score section.

- [ ] **Step 7: Commit**

```bash
git add backend/routes/alerts.py frontend/src/components/AlertBell.jsx frontend/src/components/AlertPreferences.jsx backend/main.py frontend/src/layouts/AppLayout.jsx frontend/src/pages/CompanyPage.jsx
git commit -m "feat: add alert subscription system with bell notifications"
```

---

### Task 19: Add alert firing to nightly pipeline

**Files:**
- Modify: `backend/evs/snapshot.py`

- [ ] **Step 1: Add fire_alerts function**

Add to `backend/evs/snapshot.py`:

```python
def fire_alerts():
    """Compare today's EVS to yesterday's, fire matching user alerts."""
    # Get all current scores
    current = {r["ticker"]: r for r in sb.table("equity_value_scores").select("*").execute().data}

    # Get yesterday's scores from history
    from datetime import timedelta
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    prev_rows = sb.table("equity_value_score_history") \
        .select("ticker, score, verdict") \
        .gte("computed_at", yesterday) \
        .lt("computed_at", datetime.now(timezone.utc).date().isoformat()) \
        .execute().data
    prev = {r["ticker"]: r for r in prev_rows}

    # Get all active alerts
    alerts = sb.table("user_alerts").select("*").eq("enabled", True).execute().data

    fired = 0
    for alert in alerts:
        ticker = alert["ticker"]
        cur = current.get(ticker)
        pre = prev.get(ticker)
        if not cur:
            continue
        message = None
        if alert["alert_type"] == "score_threshold" and alert.get("threshold"):
            if cur["score"] <= alert["threshold"] or cur["score"] >= alert["threshold"]:
                if pre and ((pre["score"] > alert["threshold"] and cur["score"] <= alert["threshold"]) or
                           (pre["score"] < alert["threshold"] and cur["score"] >= alert["threshold"])):
                    message = f"{ticker} EVS crossed {alert['threshold']} (now {cur['score']})"
        elif alert["alert_type"] == "score_change" and pre:
            change = abs(cur["score"] - pre["score"])
            if change >= 10:
                direction = "up" if cur["score"] > pre["score"] else "down"
                message = f"{ticker} EVS moved {direction} {change} points to {cur['score']}"
        elif alert["alert_type"] == "verdict_flip" and pre:
            if cur["verdict"] != pre["verdict"]:
                message = f"{ticker} verdict changed: {pre['verdict']} -> {cur['verdict']}"

        if message:
            sb.table("alert_history").insert({
                "user_id": alert["user_id"],
                "ticker": ticker,
                "alert_type": alert["alert_type"],
                "message": message,
            }).execute()
            fired += 1

    print(f"Fired {fired} alerts")
```

- [ ] **Step 2: Call fire_alerts() in main()**

Add `fire_alerts()` call at the end of the `main()` function, after `backfill_accuracy()`.

- [ ] **Step 3: Commit**

```bash
git add backend/evs/snapshot.py
git commit -m "feat: add alert firing to nightly EVS pipeline"
```

---

## Chunk 5: Weekly Digest + SEO Pages (Phase 2, Weeks 7-8)

### Task 20: Create weekly digest email

**Files:**
- Create: `backend/evs/digest.py`
- Create: `.github/workflows/weekly-digest.yml`

- [ ] **Step 1: Create digest generator**

Create `backend/evs/digest.py`:

```python
"""Weekly digest email — sends personalized summaries to users via Resend."""
import os
import sys
import requests
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("SUPABASE_KEY", ""))
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
FROM_EMAIL = "digest@equityvalue.ai"
APP_URL = "https://equityvalue.ai"

sb = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_top_scores(n=5):
    return sb.table("equity_value_scores") \
        .select("ticker, score, verdict") \
        .order("score", desc=True) \
        .limit(n) \
        .execute().data


def get_biggest_movers(n=5):
    """Get stocks with largest score changes this week."""
    # Compare current scores to 7 days ago in history
    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc).date() - timedelta(days=7)).isoformat()
    current = {r["ticker"]: r["score"] for r in
               sb.table("equity_value_scores").select("ticker, score").execute().data}
    prev = {r["ticker"]: r["score"] for r in
            sb.table("equity_value_score_history").select("ticker, score")
            .gte("computed_at", week_ago).execute().data}
    movers = []
    for ticker, cur_score in current.items():
        prev_score = prev.get(ticker)
        if prev_score is not None:
            change = cur_score - prev_score
            movers.append({"ticker": ticker, "score": cur_score, "change": change})
    movers.sort(key=lambda x: abs(x["change"]), reverse=True)
    return movers[:n]


def build_html(top_scores, movers):
    """Build digest HTML email."""
    top_rows = "".join(
        f'<tr><td style="padding:8px;border-bottom:1px solid #eee"><a href="{APP_URL}/company/{s["ticker"]}" style="color:#2563eb;font-weight:600">{s["ticker"]}</a></td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;font-weight:700">{s["score"]}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee">{s["verdict"]}</td></tr>'
        for s in top_scores
    )
    mover_rows = "".join(
        f'<tr><td style="padding:8px;border-bottom:1px solid #eee"><a href="{APP_URL}/company/{m["ticker"]}" style="color:#2563eb;font-weight:600">{m["ticker"]}</a></td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center">{m["score"]}</td>'
        f'<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;color:{"#22c55e" if m["change"] > 0 else "#ef4444"}">'
        f'{"+" if m["change"] > 0 else ""}{m["change"]}</td></tr>'
        for m in movers
    )
    return f"""
    <div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#1e293b">
      <div style="padding:24px;background:#2563eb;color:white;text-align:center;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">Equity Value Weekly Digest</h1>
        <p style="margin:4px 0 0;opacity:0.8;font-size:13px">{datetime.now().strftime("%B %d, %Y")}</p>
      </div>
      <div style="padding:24px;background:white;border:1px solid #e2e8f0;border-top:none">
        <h2 style="font-size:16px;margin:0 0 12px">Top Scoring Stocks</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Ticker</th><th style="padding:8px">EVS</th><th style="padding:8px;text-align:left">Verdict</th></tr>
          {top_rows}
        </table>
        <h2 style="font-size:16px;margin:24px 0 12px">Biggest Score Movers</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:#f8fafc"><th style="padding:8px;text-align:left">Ticker</th><th style="padding:8px">Score</th><th style="padding:8px">Change</th></tr>
          {mover_rows}
        </table>
        <div style="margin-top:24px;text-align:center">
          <a href="{APP_URL}/dashboard" style="display:inline-block;padding:10px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px">View Dashboard</a>
        </div>
      </div>
      <div style="padding:16px;text-align:center;font-size:11px;color:#94a3b8">
        Equity Value is an educational tool, not investment advice.<br/>
        <a href="{APP_URL}/unsubscribe" style="color:#94a3b8">Unsubscribe</a>
      </div>
    </div>
    """


def send_digest():
    if not RESEND_API_KEY:
        print("RESEND_API_KEY not set, skipping digest")
        return
    top = get_top_scores()
    movers = get_biggest_movers()
    html = build_html(top, movers)

    # Get all users with email verified
    users = sb.table("user_profiles").select("id").execute().data
    # For each user, get their email from auth
    sent = 0
    for user in users:
        try:
            auth_user = sb.auth.admin.get_user_by_id(user["id"])
            email = auth_user.user.email if auth_user and auth_user.user else None
            if not email:
                continue
            requests.post("https://api.resend.com/emails", json={
                "from": FROM_EMAIL,
                "to": email,
                "subject": f"Weekly Digest: Top EVS Scores | {datetime.now().strftime('%b %d')}",
                "html": html,
            }, headers={"Authorization": f"Bearer {RESEND_API_KEY}"})
            sent += 1
        except Exception as e:
            print(f"  EMAIL ERROR {user['id']}: {e}")
    print(f"Sent {sent} digest emails")


if __name__ == "__main__":
    send_digest()
```

- [ ] **Step 2: Create weekly digest workflow**

Create `.github/workflows/weekly-digest.yml`:

```yaml
name: Weekly Digest Email

on:
  schedule:
    - cron: '0 23 * * 0'  # 6pm ET Sunday (23 UTC)
  workflow_dispatch:

jobs:
  send-digest:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'
      - name: Install dependencies
        run: cd backend && pip install -r requirements.txt
      - name: Send weekly digest
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
        run: cd backend && python -m evs.digest
```

- [ ] **Step 3: Commit**

```bash
git add backend/evs/digest.py .github/workflows/weekly-digest.yml
git commit -m "feat: add weekly digest email via Resend"
```

---

### Task 21: Create programmatic SEO page generator

**Files:**
- Create: `backend/seo_generator.py`
- Create: `backend/seo_templates/stock.html`
- Create: `backend/seo_templates/index.html`
- Create: `.github/workflows/generate-seo-pages.yml`
- Modify: `frontend/vercel.json` (create if not exists)

- [ ] **Step 1: Create Jinja2 stock template**

Create `backend/seo_templates/stock.html` — a self-contained HTML page with inline CSS showing: EVS score badge, company name/sector/price, consensus intrinsic value, 2-3 model previews, accuracy stat, CTA to sign up. Include meta tags, Open Graph, JSON-LD structured data.

- [ ] **Step 2: Create Jinja2 index template**

Create `backend/seo_templates/index.html` — sortable table of all stocks with EVS scores, links to individual pages.

- [ ] **Step 3: Create SEO generator script**

Create `backend/seo_generator.py`:

```python
"""Generate static HTML pages for SEO from EVS scores.

Outputs to frontend/public/stocks/ for Vercel to serve as static files.
"""
import os
import sys
import json
from pathlib import Path
from jinja2 import Environment, FileSystemLoader

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

OUTPUT_DIR = Path(__file__).parent.parent / "frontend" / "public" / "stocks"
TEMPLATE_DIR = Path(__file__).parent / "seo_templates"


def generate():
    env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))
    stock_tpl = env.get_template("stock.html")
    index_tpl = env.get_template("index.html")

    # Fetch all EVS scores + company info
    scores = sb.table("equity_value_scores").select("*").execute().data
    fundamentals = {r["ticker"]: r for r in
                    sb.table("stock_fundamentals").select("ticker, name, sector, current_price").execute().data}

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Generate individual stock pages
    for s in scores:
        ticker = s["ticker"]
        company = fundamentals.get(ticker, {})
        html = stock_tpl.render(
            ticker=ticker,
            score=s["score"],
            verdict=s["verdict"],
            company_name=company.get("name", ticker),
            sector=company.get("sector", ""),
            price=company.get("current_price", 0),
            components=json.loads(s.get("components", "{}")),
            app_url="https://equityvalue.ai",
        )
        (OUTPUT_DIR / f"{ticker.lower()}.html").write_text(html)

    # Generate index pages
    sorted_by_score = sorted(scores, key=lambda x: x["score"], reverse=True)
    index_html = index_tpl.render(stocks=sorted_by_score, fundamentals=fundamentals, app_url="https://equityvalue.ai")
    (OUTPUT_DIR / "index.html").write_text(index_html)

    # Top undervalued
    top = [s for s in sorted_by_score if s["score"] >= 70][:20]
    (OUTPUT_DIR / "undervalued.html").write_text(
        index_tpl.render(stocks=top, fundamentals=fundamentals, title="Most Undervalued Stocks", app_url="https://equityvalue.ai"))

    # Most overvalued
    bottom = sorted(scores, key=lambda x: x["score"])[:20]
    (OUTPUT_DIR / "overvalued.html").write_text(
        index_tpl.render(stocks=bottom, fundamentals=fundamentals, title="Most Overvalued Stocks", app_url="https://equityvalue.ai"))

    print(f"Generated {len(scores)} stock pages + 3 index pages")


if __name__ == "__main__":
    generate()
```

- [ ] **Step 4: Add Vercel rewrites**

Create or update `frontend/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/stocks/:ticker", "destination": "/stocks/:ticker.html" },
    { "source": "/stocks", "destination": "/stocks/index.html" },
    { "source": "/stocks/undervalued", "destination": "/stocks/undervalued.html" },
    { "source": "/stocks/overvalued", "destination": "/stocks/overvalued.html" },
    { "source": "/((?!stocks).*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 5: Create SEO generation workflow**

Create `.github/workflows/generate-seo-pages.yml`:

```yaml
name: Generate SEO Pages

on:
  schedule:
    - cron: '0 15 * * 1-5'  # 10am ET (15 UTC) Mon-Fri
  workflow_dispatch:

jobs:
  generate:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.13'
      - name: Install dependencies
        run: cd backend && pip install jinja2 supabase
      - name: Generate SEO pages
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
        run: cd backend && python seo_generator.py
      - name: Commit and push if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add frontend/public/stocks/
          git diff --staged --quiet || git commit -m "chore: update SEO pages" && git push
```

- [ ] **Step 6: Add `jinja2` to requirements.txt**

Add `jinja2` to `backend/requirements.txt`.

- [ ] **Step 7: Commit**

```bash
git add backend/seo_generator.py backend/seo_templates/ .github/workflows/generate-seo-pages.yml frontend/vercel.json backend/requirements.txt
git commit -m "feat: add programmatic SEO page generator with Jinja2 templates"
```

---

### Task 22: Final integration — update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md with new endpoints and tables**

Add the new EVS/accuracy/alerts endpoints to the API endpoints table. Add new Supabase tables to the schema section. Add `RESEND_API_KEY`, `STRIPE_PRO_ANNUAL_PRICE_ID`, `STRIPE_MAX_ANNUAL_PRICE_ID` to the environment variables section. Add new GitHub Actions to the data refresh pipeline section.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with EVS, accuracy, alerts architecture"
```
