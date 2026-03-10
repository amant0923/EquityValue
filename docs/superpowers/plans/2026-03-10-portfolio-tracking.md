# Portfolio Tracking Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to create named portfolios of S&P 500 stocks, track daily P&L with live prices on every page refresh, and view historical performance via a P&L line chart backed by daily snapshots.

**Architecture:** Three new Supabase tables (portfolios, holdings, snapshots) with RLS. New FastAPI route file with auth-gated CRUD + live pricing endpoints. Two new React pages (list + detail) with Recharts charts. GitHub Actions cron job for daily snapshot recording.

**Tech Stack:** FastAPI, Supabase (Postgres + RLS + Auth), React, React Router, Recharts, Framer Motion, GitHub Actions, FMP API.

**Spec:** `docs/superpowers/specs/2026-03-10-portfolio-tracking-design.md`

---

## Chunk 1: Database & Backend API

### Task 1: Create Database Migration

**Files:**
- Create: `backend/migrations/003_portfolio_tables.sql`

- [ ] **Step 1: Write the migration SQL**

Create `backend/migrations/003_portfolio_tables.sql`:

```sql
-- Portfolio tracking tables
-- Run in Supabase SQL Editor

-- 1. User portfolios
CREATE TABLE IF NOT EXISTS user_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_up_user ON user_portfolios(user_id);

-- 2. Portfolio holdings
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES user_portfolios(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  shares NUMERIC NOT NULL CHECK (shares > 0),
  avg_price NUMERIC NOT NULL CHECK (avg_price > 0),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, ticker)
);

CREATE INDEX idx_ph_portfolio ON portfolio_holdings(portfolio_id);

-- 3. Portfolio snapshots
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES user_portfolios(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_value NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  UNIQUE(portfolio_id, snapshot_date)
);

CREATE INDEX idx_ps_portfolio_date ON portfolio_snapshots(portfolio_id, snapshot_date);

-- 4. RLS policies
ALTER TABLE user_portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_portfolios" ON user_portfolios
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_holdings" ON portfolio_holdings
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM user_portfolios WHERE user_id = auth.uid())
  );

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_snapshots" ON portfolio_snapshots
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM user_portfolios WHERE user_id = auth.uid())
  );

-- 5. Auto-update updated_at on holdings
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_holdings_updated_at
  BEFORE UPDATE ON portfolio_holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Go to Supabase Dashboard → SQL Editor → paste and run the full SQL from `003_portfolio_tables.sql`. Verify all 3 tables appear in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add backend/migrations/003_portfolio_tables.sql
git commit -m "feat: add portfolio tables migration (portfolios, holdings, snapshots)"
```

---

### Task 2: Backend Portfolio Routes — CRUD Endpoints

**Files:**
- Create: `backend/routes/portfolio.py`
- Modify: `backend/main.py` (add router include)

- [ ] **Step 1: Create the portfolio route file**

Create `backend/routes/portfolio.py`:

```python
"""Routes for portfolio management — all endpoints require auth."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
import os
from supabase import create_client
from auth import get_current_user, get_user_profile

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

router = APIRouter()

# Tier limits: {plan: (max_portfolios, max_holdings_per_portfolio)}
PORTFOLIO_LIMITS = {
    "free": (1, 5),
    "pro": (5, 25),
    "max": (999999, 999999),
}


# ── Request models ──────────────────────────────────────────────

class CreatePortfolioRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)

class AddHoldingRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10)
    shares: float = Field(..., gt=0)
    avg_price: float = Field(..., gt=0)

class EditHoldingRequest(BaseModel):
    shares: float | None = Field(None, gt=0)
    avg_price: float | None = Field(None, gt=0)


# ── Helpers ─────────────────────────────────────────────────────

async def _get_limits(user_id: str):
    """Return (max_portfolios, max_holdings) for user's plan."""
    profile = await get_user_profile(user_id)
    plan = profile.get("plan", "free")
    return PORTFOLIO_LIMITS.get(plan, PORTFOLIO_LIMITS["free"])


async def _verify_portfolio_owner(portfolio_id: str, user_id: str):
    """Raise 404 if portfolio doesn't exist or isn't owned by user."""
    result = supabase.table("user_portfolios") \
        .select("id") \
        .eq("id", portfolio_id) \
        .eq("user_id", user_id) \
        .execute()
    if not result.data:
        raise HTTPException(404, "Portfolio not found")


# ── Portfolio CRUD ──────────────────────────────────────────────

@router.get("/portfolio")
async def list_portfolios(user: dict = Depends(get_current_user)):
    """List all portfolios for the current user with holding counts."""
    user_id = user["sub"]
    portfolios = supabase.table("user_portfolios") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at") \
        .execute().data or []

    # Attach holding count to each portfolio
    for p in portfolios:
        count = supabase.table("portfolio_holdings") \
            .select("id", count="exact") \
            .eq("portfolio_id", p["id"]) \
            .execute()
        p["holding_count"] = count.count if count.count is not None else 0

    max_portfolios, max_holdings = await _get_limits(user_id)
    return {
        "portfolios": portfolios,
        "limits": {"max_portfolios": max_portfolios, "max_holdings": max_holdings},
    }


@router.post("/portfolio")
async def create_portfolio(body: CreatePortfolioRequest, user: dict = Depends(get_current_user)):
    """Create a new portfolio."""
    user_id = user["sub"]
    max_portfolios, _ = await _get_limits(user_id)

    # Check limit
    existing = supabase.table("user_portfolios") \
        .select("id", count="exact") \
        .eq("user_id", user_id) \
        .execute()
    if (existing.count or 0) >= max_portfolios:
        raise HTTPException(403, f"Portfolio limit reached ({max_portfolios}). Upgrade your plan.")

    result = supabase.table("user_portfolios") \
        .insert({"user_id": user_id, "name": body.name.strip()}) \
        .execute()
    return result.data[0]


@router.delete("/portfolio/{portfolio_id}")
async def delete_portfolio(portfolio_id: str, user: dict = Depends(get_current_user)):
    """Delete a portfolio and all its holdings/snapshots (cascade)."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])
    supabase.table("user_portfolios").delete().eq("id", portfolio_id).execute()
    return {"ok": True}


# ── Holdings CRUD ───────────────────────────────────────────────

@router.get("/portfolio/{portfolio_id}/holdings")
async def list_holdings(portfolio_id: str, user: dict = Depends(get_current_user)):
    """List all holdings in a portfolio."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])
    holdings = supabase.table("portfolio_holdings") \
        .select("*") \
        .eq("portfolio_id", portfolio_id) \
        .order("added_at") \
        .execute().data or []
    return holdings


@router.post("/portfolio/{portfolio_id}/holdings")
async def add_holding(portfolio_id: str, body: AddHoldingRequest, user: dict = Depends(get_current_user)):
    """Add a holding to a portfolio."""
    user_id = user["sub"]
    await _verify_portfolio_owner(portfolio_id, user_id)
    _, max_holdings = await _get_limits(user_id)

    # Check holding limit
    existing = supabase.table("portfolio_holdings") \
        .select("id", count="exact") \
        .eq("portfolio_id", portfolio_id) \
        .execute()
    if (existing.count or 0) >= max_holdings:
        raise HTTPException(403, f"Holding limit reached ({max_holdings}). Upgrade your plan.")

    # Validate ticker exists in S&P 500
    ticker = body.ticker.upper().strip()
    check = supabase.table("stock_fundamentals") \
        .select("ticker") \
        .eq("ticker", ticker) \
        .execute()
    if not check.data:
        raise HTTPException(400, f"Ticker {ticker} not found in S&P 500")

    try:
        result = supabase.table("portfolio_holdings") \
            .insert({
                "portfolio_id": portfolio_id,
                "ticker": ticker,
                "shares": body.shares,
                "avg_price": body.avg_price,
            }).execute()
        return result.data[0]
    except Exception as e:
        if "duplicate" in str(e).lower() or "unique" in str(e).lower():
            raise HTTPException(409, f"{ticker} already in this portfolio. Edit the existing holding instead.")
        raise


@router.put("/portfolio/{portfolio_id}/holdings/{holding_id}")
async def edit_holding(portfolio_id: str, holding_id: str, body: EditHoldingRequest, user: dict = Depends(get_current_user)):
    """Edit shares and/or avg_price of a holding."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])

    updates = {}
    if body.shares is not None:
        updates["shares"] = body.shares
    if body.avg_price is not None:
        updates["avg_price"] = body.avg_price
    if not updates:
        raise HTTPException(400, "Nothing to update")

    result = supabase.table("portfolio_holdings") \
        .update(updates) \
        .eq("id", holding_id) \
        .eq("portfolio_id", portfolio_id) \
        .execute()
    if not result.data:
        raise HTTPException(404, "Holding not found")
    return result.data[0]


@router.delete("/portfolio/{portfolio_id}/holdings/{holding_id}")
async def delete_holding(portfolio_id: str, holding_id: str, user: dict = Depends(get_current_user)):
    """Remove a holding from a portfolio."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])
    supabase.table("portfolio_holdings").delete() \
        .eq("id", holding_id) \
        .eq("portfolio_id", portfolio_id) \
        .execute()
    return {"ok": True}


# ── Live P&L ────────────────────────────────────────────────────

@router.get("/portfolio/{portfolio_id}/live")
async def get_live_pnl(portfolio_id: str, user: dict = Depends(get_current_user)):
    """Fetch current prices and calculate live P&L for all holdings."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])

    holdings = supabase.table("portfolio_holdings") \
        .select("*") \
        .eq("portfolio_id", portfolio_id) \
        .execute().data or []

    if not holdings:
        return {"holdings": [], "total_value": 0, "total_cost": 0, "total_pnl": 0, "total_pnl_pct": 0}

    # Fetch current prices in one query
    tickers = [h["ticker"] for h in holdings]
    prices_result = supabase.table("stock_fundamentals") \
        .select("ticker, current_price, name") \
        .in_("ticker", tickers) \
        .execute().data or []
    price_map = {r["ticker"]: r for r in prices_result}

    enriched = []
    total_value = 0
    total_cost = 0

    for h in holdings:
        price_data = price_map.get(h["ticker"], {})
        current_price = float(price_data.get("current_price", 0))
        shares = float(h["shares"])
        avg_price = float(h["avg_price"])

        market_value = shares * current_price
        cost_basis = shares * avg_price
        pnl = market_value - cost_basis
        pnl_pct = ((current_price - avg_price) / avg_price * 100) if avg_price > 0 else 0

        total_value += market_value
        total_cost += cost_basis

        enriched.append({
            "id": h["id"],
            "ticker": h["ticker"],
            "name": price_data.get("name", h["ticker"]),
            "shares": shares,
            "avg_price": avg_price,
            "current_price": current_price,
            "market_value": round(market_value, 2),
            "cost_basis": round(cost_basis, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
        })

    # Calculate weights
    for item in enriched:
        item["weight"] = round((item["market_value"] / total_value * 100) if total_value > 0 else 0, 2)

    total_pnl = total_value - total_cost
    total_pnl_pct = ((total_value - total_cost) / total_cost * 100) if total_cost > 0 else 0

    return {
        "holdings": enriched,
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": round(total_pnl_pct, 2),
    }


# ── Snapshots ───────────────────────────────────────────────────

@router.get("/portfolio/{portfolio_id}/snapshots")
async def get_snapshots(portfolio_id: str, days: str = "90", user: dict = Depends(get_current_user)):
    """Get historical portfolio snapshots for P&L chart."""
    await _verify_portfolio_owner(portfolio_id, user["sub"])

    query = supabase.table("portfolio_snapshots") \
        .select("*") \
        .eq("portfolio_id", portfolio_id) \
        .order("snapshot_date")

    if days != "all":
        from datetime import date, timedelta
        cutoff = (date.today() - timedelta(days=int(days))).isoformat()
        query = query.gte("snapshot_date", cutoff)

    snapshots = query.execute().data or []
    return snapshots
```

- [ ] **Step 2: Register the router in main.py**

Open `backend/main.py`. Add the import near the other router imports (around the `from routes.financials import router as financials_router` lines):

```python
from routes.portfolio import router as portfolio_router
```

Add the include near the other `app.include_router()` calls:

```python
app.include_router(portfolio_router)
```

- [ ] **Step 3: Test the backend locally**

```bash
cd backend
FINNHUB_KEY=... SUPABASE_URL=... SUPABASE_KEY=... uvicorn main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` — verify all `/portfolio` endpoints appear in the Swagger UI.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/portfolio.py backend/main.py
git commit -m "feat: add portfolio CRUD + live P&L backend routes"
```

---

### Task 3: Daily Snapshot Script & GitHub Actions Workflow

**Files:**
- Create: `backend/snapshot_portfolios.py`
- Create: `.github/workflows/portfolio-snapshots.yml`

- [ ] **Step 1: Write the snapshot script**

Create `backend/snapshot_portfolios.py`:

```python
"""Daily portfolio snapshot job.
Runs Mon-Fri after market close via GitHub Actions.
Uses service_role key to bypass RLS and read all users' portfolios.
"""
import os
import json
import urllib.request
from datetime import date, datetime
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
FMP_KEY = os.environ["FMP_KEY"]

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def is_weekend():
    return datetime.utcnow().weekday() >= 5  # Sat=5, Sun=6


def fetch_bulk_prices(tickers: list[str]) -> dict[str, float]:
    """Fetch closing prices from stock_fundamentals table."""
    result = sb.table("stock_fundamentals") \
        .select("ticker, current_price") \
        .in_("ticker", tickers) \
        .execute().data or []
    return {r["ticker"]: float(r["current_price"]) for r in result if r.get("current_price")}


def main():
    if is_weekend():
        print("Weekend — skipping snapshot.")
        return

    today = date.today().isoformat()
    print(f"Portfolio snapshot for {today}")

    # Fetch all holdings across all portfolios
    holdings = sb.table("portfolio_holdings") \
        .select("portfolio_id, ticker, shares, avg_price") \
        .execute().data or []

    if not holdings:
        print("No holdings found — nothing to snapshot.")
        return

    # Unique tickers
    tickers = list(set(h["ticker"] for h in holdings))
    print(f"Fetching prices for {len(tickers)} tickers...")
    prices = fetch_bulk_prices(tickers)
    print(f"Got prices for {len(prices)} tickers.")

    # Group holdings by portfolio
    portfolios: dict[str, list] = {}
    for h in holdings:
        portfolios.setdefault(h["portfolio_id"], []).append(h)

    # Compute snapshots
    snapshots = []
    for pid, holdings_list in portfolios.items():
        total_value = 0.0
        total_cost = 0.0
        for h in holdings_list:
            price = prices.get(h["ticker"], 0)
            shares = float(h["shares"])
            total_value += shares * price
            total_cost += shares * float(h["avg_price"])

        snapshots.append({
            "portfolio_id": pid,
            "snapshot_date": today,
            "total_value": round(total_value, 2),
            "total_cost": round(total_cost, 2),
        })

    # Upsert snapshots
    print(f"Upserting {len(snapshots)} snapshots...")
    sb.table("portfolio_snapshots") \
        .upsert(snapshots, on_conflict="portfolio_id,snapshot_date") \
        .execute()

    print(f"Done. Snapshotted {len(snapshots)} portfolios.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write the GitHub Actions workflow**

Create `.github/workflows/portfolio-snapshots.yml`:

```yaml
name: Portfolio Daily Snapshots

on:
  schedule:
    - cron: "30 21 * * 1-5"  # Mon-Fri at 9:30 PM UTC (after US market close)
  workflow_dispatch:  # Allow manual trigger

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install supabase

      - name: Run snapshot
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          FMP_KEY: ${{ secrets.FMP_KEY }}
        run: python backend/snapshot_portfolios.py
```

- [ ] **Step 3: Add `SUPABASE_SERVICE_KEY` to GitHub Secrets**

Go to GitHub repo → Settings → Secrets → Actions → New repository secret:
- Name: `SUPABASE_SERVICE_KEY`
- Value: The Supabase service_role key (found in Supabase dashboard → Settings → API → `service_role` key, NOT the anon key)

- [ ] **Step 4: Commit**

```bash
git add backend/snapshot_portfolios.py .github/workflows/portfolio-snapshots.yml
git commit -m "feat: add daily portfolio snapshot job with GitHub Actions"
```

---

## Chunk 2: Frontend Pages & Components

### Task 4: Navigation Integration

**Files:**
- Modify: `frontend/src/App.jsx` (add lazy imports + routes)
- Modify: `frontend/src/components/Sidebar.jsx` (add Portfolio nav item)
- Modify: `frontend/src/layouts/AppLayout.jsx` (add handlePageChange case + breadcrumb)

- [ ] **Step 1: Add lazy imports to App.jsx**

Open `frontend/src/App.jsx`. Add these two lazy imports near the other lazy imports at the top:

```javascript
const PortfolioListPage = lazy(() => import("./pages/PortfolioListPage"));
const PortfolioDetailPage = lazy(() => import("./pages/PortfolioDetailPage"));
```

- [ ] **Step 2: Add routes to App.jsx**

Inside the `<Route element={<AppLayout />}>` block, add these two routes (before the `<Route path="*"` catch-all):

```javascript
<Route path="/portfolio" element={<PortfolioListPage />} />
<Route path="/portfolio/:id" element={<PortfolioDetailPage />} />
```

- [ ] **Step 3: Add Portfolio to Sidebar.jsx NAV array**

Open `frontend/src/components/Sidebar.jsx`. Add a new entry to the `NAV` array after the "compare" entry:

```javascript
{
  id: "portfolio",
  label: "Portfolio",
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  ),
},
```

- [ ] **Step 4: Add handlePageChange case in AppLayout.jsx**

Open `frontend/src/layouts/AppLayout.jsx`. In the `handlePageChange` function, add:

```javascript
else if (p === "portfolio") navigate("/portfolio");
```

Also add `portfolio: "Portfolio"` to the breadcrumb map object.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/Sidebar.jsx frontend/src/layouts/AppLayout.jsx
git commit -m "feat: add portfolio routes and sidebar navigation"
```

---

### Task 5: Portfolio List Page

**Files:**
- Create: `frontend/src/pages/PortfolioListPage.jsx`
- Create: `frontend/src/components/portfolio/PortfolioCard.jsx`
- Create: `frontend/src/components/portfolio/CreatePortfolioModal.jsx`

- [ ] **Step 1: Create CreatePortfolioModal**

Create `frontend/src/components/portfolio/CreatePortfolioModal.jsx`:

```jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CreatePortfolioModal({ open, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onCreate(name.trim());
      setName("");
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create portfolio");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass-card"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{ padding: 32, maxWidth: 420, width: "90%", margin: "20vh auto" }}
        >
          <h3 style={{ margin: "0 0 20px", fontSize: 18 }}>Create Portfolio</h3>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Portfolio name (e.g. Long Term)"
              maxLength={50}
              autoFocus
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "var(--surface1)",
                color: "var(--text1)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            {error && (
              <p style={{ color: "var(--red)", fontSize: 13, margin: "8px 0 0" }}>{error}</p>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading || !name.trim()} className="btn-primary">
                {loading ? "Creating..." : "Create"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Create PortfolioCard**

Create `frontend/src/components/portfolio/PortfolioCard.jsx`:

```jsx
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function PortfolioCard({ portfolio, liveData }) {
  const navigate = useNavigate();
  const totalValue = liveData?.total_value ?? 0;
  const totalPnl = liveData?.total_pnl ?? 0;
  const totalPnlPct = liveData?.total_pnl_pct ?? 0;
  const isPositive = totalPnl >= 0;

  return (
    <motion.div
      className="glass-card"
      whileHover={{ scale: 1.02 }}
      onClick={() => navigate(`/portfolio/${portfolio.id}`)}
      style={{ padding: 24, cursor: "pointer" }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--text1)" }}>
        {portfolio.name}
      </h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text2)" }}>
        {portfolio.holding_count} holding{portfolio.holding_count !== 1 ? "s" : ""}
      </p>

      {totalValue > 0 ? (
        <>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text1)" }}>
            ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p style={{
            margin: "4px 0 0",
            fontSize: 14,
            fontWeight: 500,
            color: isPositive ? "var(--green)" : "var(--red)",
          }}>
            {isPositive ? "+" : ""}${totalPnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            {" "}
            ({isPositive ? "+" : ""}{totalPnlPct.toFixed(2)}%)
          </p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: "var(--text2)" }}>No holdings yet</p>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 3: Create PortfolioListPage**

Create `frontend/src/pages/PortfolioListPage.jsx`:

```jsx
import { useState, useEffect } from "react";
import api from "../lib/api";
import PortfolioCard from "../components/portfolio/PortfolioCard";
import CreatePortfolioModal from "../components/portfolio/CreatePortfolioModal";

export default function PortfolioListPage() {
  const [portfolios, setPortfolios] = useState([]);
  const [limits, setLimits] = useState({ max_portfolios: 1, max_holdings: 5 });
  const [liveDataMap, setLiveDataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchPortfolios = async () => {
    try {
      const { data } = await api.get("/portfolio");
      setPortfolios(data.portfolios);
      setLimits(data.limits);

      // Fetch live data for each portfolio
      const liveMap = {};
      await Promise.allSettled(
        data.portfolios.map(async (p) => {
          try {
            const { data: live } = await api.get(`/portfolio/${p.id}/live`);
            liveMap[p.id] = live;
          } catch {}
        })
      );
      setLiveDataMap(liveMap);
    } catch (err) {
      console.error("Failed to load portfolios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPortfolios(); }, []);

  const handleCreate = async (name) => {
    await api.post("/portfolio", { name });
    await fetchPortfolios();
  };

  const atLimit = portfolios.length >= limits.max_portfolios;

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
          Loading portfolios...
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, color: "var(--text1)" }}>Portfolios</h1>
        <button
          className="btn-primary"
          onClick={() => setShowCreate(true)}
          disabled={atLimit}
          title={atLimit ? "Upgrade to create more portfolios" : ""}
        >
          + Create Portfolio
        </button>
      </div>

      {atLimit && portfolios.length > 0 && (
        <div className="glass-card" style={{ padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "var(--text2)" }}>
          You've reached your portfolio limit ({limits.max_portfolios}). Upgrade your plan for more.
        </div>
      )}

      {portfolios.length === 0 ? (
        <div className="glass-card" style={{ padding: 60, textAlign: "center" }}>
          <p style={{ fontSize: 18, color: "var(--text1)", margin: "0 0 8px" }}>No portfolios yet</p>
          <p style={{ fontSize: 14, color: "var(--text2)", margin: "0 0 20px" }}>
            Create your first portfolio to start tracking your investments.
          </p>
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            Create Portfolio
          </button>
        </div>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 16,
        }}>
          {portfolios.map((p) => (
            <PortfolioCard key={p.id} portfolio={p} liveData={liveDataMap[p.id]} />
          ))}
        </div>
      )}

      <CreatePortfolioModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/PortfolioListPage.jsx frontend/src/components/portfolio/PortfolioCard.jsx frontend/src/components/portfolio/CreatePortfolioModal.jsx
git commit -m "feat: add portfolio list page with card grid and create modal"
```

---

### Task 6: Portfolio Detail Page — Header, Holdings Table, Add/Edit Modals

**Files:**
- Create: `frontend/src/pages/PortfolioDetailPage.jsx`
- Create: `frontend/src/components/portfolio/PortfolioHeader.jsx`
- Create: `frontend/src/components/portfolio/HoldingsTable.jsx`
- Create: `frontend/src/components/portfolio/AddHoldingModal.jsx`

- [ ] **Step 1: Create PortfolioHeader**

Create `frontend/src/components/portfolio/PortfolioHeader.jsx`:

```jsx
export default function PortfolioHeader({ name, liveData, onDelete }) {
  const totalValue = liveData?.total_value ?? 0;
  const totalCost = liveData?.total_cost ?? 0;
  const totalPnl = liveData?.total_pnl ?? 0;
  const totalPnlPct = liveData?.total_pnl_pct ?? 0;
  const isPositive = totalPnl >= 0;

  const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 4px", fontSize: 22, color: "var(--text1)" }}>{name}</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text2)" }}>
            Cost basis: ${fmt(totalCost)}
          </p>
        </div>
        <button
          onClick={onDelete}
          style={{
            background: "transparent",
            border: "1px solid var(--red)",
            color: "var(--red)",
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Delete Portfolio
        </button>
      </div>

      <div style={{ display: "flex", gap: 32, marginTop: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text2)" }}>Total Value</p>
          <p style={{ margin: "2px 0 0", fontSize: 28, fontWeight: 600, color: "var(--text1)" }}>
            ${fmt(totalValue)}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text2)" }}>Total P&L</p>
          <p style={{
            margin: "2px 0 0",
            fontSize: 28,
            fontWeight: 600,
            color: isPositive ? "var(--green)" : "var(--red)",
          }}>
            {isPositive ? "+" : ""}${fmt(totalPnl)}
            <span style={{ fontSize: 16, marginLeft: 8 }}>
              ({isPositive ? "+" : ""}{totalPnlPct.toFixed(2)}%)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create HoldingsTable**

Create `frontend/src/components/portfolio/HoldingsTable.jsx`:

```jsx
import { useState } from "react";

export default function HoldingsTable({ holdings, onEdit, onDelete }) {
  const [sortKey, setSortKey] = useState("ticker");
  const [sortDir, setSortDir] = useState(1);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(-sortDir);
    else { setSortKey(key); setSortDir(1); }
  };

  const sorted = [...holdings].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (typeof av === "string") return av.localeCompare(bv) * sortDir;
    return ((av || 0) - (bv || 0)) * sortDir;
  });

  const fmt = (n) => n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—";
  const arrow = (key) => sortKey === key ? (sortDir === 1 ? " ▲" : " ▼") : "";

  const columns = [
    { key: "ticker", label: "Ticker" },
    { key: "shares", label: "Shares" },
    { key: "avg_price", label: "Avg Price" },
    { key: "current_price", label: "Price" },
    { key: "market_value", label: "Value" },
    { key: "pnl", label: "P&L" },
    { key: "pnl_pct", label: "P&L %" },
    { key: "weight", label: "Weight" },
  ];

  // Desktop table
  const desktopTable = (
    <div className="holdings-table-wrap" style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => handleSort(c.key)}
                style={{
                  padding: "10px 12px",
                  textAlign: c.key === "ticker" ? "left" : "right",
                  color: "var(--text2)",
                  fontWeight: 500,
                  cursor: "pointer",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                  userSelect: "none",
                }}
              >
                {c.label}{arrow(c.key)}
              </th>
            ))}
            <th style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", width: 80 }}></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => {
            const isPos = (h.pnl || 0) >= 0;
            const pnlColor = isPos ? "var(--green)" : "var(--red)";
            return (
              <tr key={h.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text1)" }}>
                  {h.ticker}
                  {h.name && <span style={{ fontWeight: 400, fontSize: 12, color: "var(--text2)", marginLeft: 8 }}>{h.name}</span>}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text1)" }}>{h.shares}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text1)" }}>${fmt(h.avg_price)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text1)" }}>${fmt(h.current_price)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text1)" }}>${fmt(h.market_value)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: pnlColor, fontWeight: 500 }}>
                  {isPos ? "+" : ""}${fmt(h.pnl)}
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: pnlColor, fontWeight: 500 }}>
                  {isPos ? "+" : ""}{h.pnl_pct?.toFixed(2)}%
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right", color: "var(--text1)" }}>
                  {h.weight?.toFixed(1)}%
                </td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <button
                    onClick={() => onEdit(h)}
                    style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", marginRight: 8, fontSize: 13 }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(h)}
                    style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 13 }}
                  >
                    Del
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Mobile cards
  const mobileCards = (
    <div className="holdings-mobile" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {sorted.map((h) => {
        const isPos = (h.pnl || 0) >= 0;
        const pnlColor = isPos ? "var(--green)" : "var(--red)";
        return (
          <div key={h.id} className="glass-card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: "var(--text1)" }}>{h.ticker}</span>
              <span style={{ color: pnlColor, fontWeight: 500 }}>
                {isPos ? "+" : ""}{h.pnl_pct?.toFixed(2)}%
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 13, color: "var(--text2)" }}>
              <span>{h.shares} shares @ ${fmt(h.avg_price)}</span>
              <span style={{ textAlign: "right" }}>Now ${fmt(h.current_price)}</span>
              <span>Value: ${fmt(h.market_value)}</span>
              <span style={{ textAlign: "right", color: pnlColor }}>P&L: {isPos ? "+" : ""}${fmt(h.pnl)}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => onEdit(h)} className="btn-secondary" style={{ flex: 1, padding: "6px 0", fontSize: 13 }}>Edit</button>
              <button onClick={() => onDelete(h)} style={{ flex: 1, padding: "6px 0", fontSize: 13, background: "transparent", border: "1px solid var(--red)", color: "var(--red)", borderRadius: 6, cursor: "pointer" }}>Remove</button>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .holdings-table-wrap { display: none !important; }
          .holdings-mobile { display: flex !important; }
        }
        @media (min-width: 769px) {
          .holdings-mobile { display: none !important; }
        }
      `}</style>
      <div className="glass-card" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text1)" }}>Holdings</h3>
        {holdings.length === 0 ? (
          <p style={{ color: "var(--text2)", fontSize: 14 }}>No holdings yet. Add your first stock.</p>
        ) : (
          <>
            {desktopTable}
            {mobileCards}
          </>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Create AddHoldingModal**

Create `frontend/src/components/portfolio/AddHoldingModal.jsx`:

```jsx
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AddHoldingModal({ open, onClose, onAdd, editing }) {
  const [ticker, setTicker] = useState(editing?.ticker || "");
  const [shares, setShares] = useState(editing?.shares?.toString() || "");
  const [avgPrice, setAvgPrice] = useState(editing?.avg_price?.toString() || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchTimeout, setSearchTimeout] = useState(null);

  const isEdit = !!editing;

  const handleTickerChange = (val) => {
    setTicker(val.toUpperCase());
    if (searchTimeout) clearTimeout(searchTimeout);
    if (val.length >= 1 && !isEdit) {
      const timeout = setTimeout(async () => {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/search/${val}`
          );
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.slice(0, 6));
          }
        } catch {}
      }, 300);
      setSearchTimeout(timeout);
    } else {
      setSearchResults([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ticker.trim() || !shares || !avgPrice) return;
    setLoading(true);
    setError("");
    try {
      await onAdd({
        ticker: ticker.trim(),
        shares: parseFloat(shares),
        avg_price: parseFloat(avgPrice),
        ...(isEdit ? { id: editing.id } : {}),
      });
      setTicker("");
      setShares("");
      setAvgPrice("");
      setSearchResults([]);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save holding");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--surface1)",
    color: "var(--text1)",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="glass-card"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{ padding: 32, maxWidth: 420, width: "90%", margin: "15vh auto" }}
        >
          <h3 style={{ margin: "0 0 20px", fontSize: 18 }}>
            {isEdit ? `Edit ${editing.ticker}` : "Add Holding"}
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14, position: "relative" }}>
              <label style={{ fontSize: 13, color: "var(--text2)", display: "block", marginBottom: 4 }}>Ticker</label>
              <input
                type="text"
                value={ticker}
                onChange={(e) => handleTickerChange(e.target.value)}
                placeholder="e.g. AAPL"
                disabled={isEdit}
                autoFocus={!isEdit}
                style={{ ...inputStyle, opacity: isEdit ? 0.6 : 1 }}
              />
              {searchResults.length > 0 && (
                <div style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  zIndex: 10,
                  maxHeight: 200,
                  overflow: "auto",
                }}>
                  {searchResults.map((r) => (
                    <div
                      key={r.ticker || r.symbol}
                      onClick={() => { setTicker(r.ticker || r.symbol); setSearchResults([]); }}
                      style={{
                        padding: "8px 14px",
                        cursor: "pointer",
                        fontSize: 13,
                        color: "var(--text1)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <strong>{r.ticker || r.symbol}</strong>
                      <span style={{ color: "var(--text2)", marginLeft: 8 }}>{r.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "var(--text2)", display: "block", marginBottom: 4 }}>Shares</label>
              <input
                type="number"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                placeholder="e.g. 50"
                min="0.01"
                step="any"
                autoFocus={isEdit}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, color: "var(--text2)", display: "block", marginBottom: 4 }}>Average Purchase Price ($)</label>
              <input
                type="number"
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                placeholder="e.g. 180.50"
                min="0.01"
                step="any"
                style={inputStyle}
              />
            </div>

            {error && (
              <p style={{ color: "var(--red)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={loading || !ticker.trim() || !shares || !avgPrice} className="btn-primary">
                {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Holding"}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Create PortfolioDetailPage (initial — header + table + modals)**

Create `frontend/src/pages/PortfolioDetailPage.jsx`:

```jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../lib/api";
import PortfolioHeader from "../components/portfolio/PortfolioHeader";
import HoldingsTable from "../components/portfolio/HoldingsTable";
import AddHoldingModal from "../components/portfolio/AddHoldingModal";

export default function PortfolioDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchData = async () => {
    try {
      setError("");
      const [portfolioRes, liveRes] = await Promise.all([
        api.get("/portfolio"),
        api.get(`/portfolio/${id}/live`),
      ]);
      const p = portfolioRes.data.portfolios.find((p) => p.id === id);
      if (!p) { navigate("/portfolio"); return; }
      setPortfolio(p);
      setLiveData(liveRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleAddHolding = async (data) => {
    if (data.id) {
      await api.put(`/portfolio/${id}/holdings/${data.id}`, {
        shares: data.shares,
        avg_price: data.avg_price,
      });
    } else {
      await api.post(`/portfolio/${id}/holdings`, data);
    }
    await fetchData();
  };

  const handleDeleteHolding = async (holding) => {
    if (!confirm(`Remove ${holding.ticker} from this portfolio?`)) return;
    await api.delete(`/portfolio/${id}/holdings/${holding.id}`);
    await fetchData();
  };

  const handleDeletePortfolio = async () => {
    if (!confirm("Delete this entire portfolio? This cannot be undone.")) return;
    await api.delete(`/portfolio/${id}`);
    navigate("/portfolio");
  };

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div className="glass-card" style={{ padding: 40, textAlign: "center", color: "var(--text2)" }}>
          Loading portfolio...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ color: "var(--red)", margin: "0 0 12px" }}>{error}</p>
          <button className="btn-primary" onClick={fetchData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <button
        onClick={() => navigate("/portfolio")}
        style={{
          background: "none",
          border: "none",
          color: "var(--text2)",
          cursor: "pointer",
          fontSize: 14,
          marginBottom: 16,
          padding: 0,
        }}
      >
        ← Back to Portfolios
      </button>

      <PortfolioHeader
        name={portfolio?.name}
        liveData={liveData}
        onDelete={handleDeletePortfolio}
      />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowAdd(true); }}>
          + Add Holding
        </button>
      </div>

      <HoldingsTable
        holdings={liveData?.holdings || []}
        onEdit={(h) => { setEditing(h); setShowAdd(true); }}
        onDelete={handleDeleteHolding}
      />

      <AddHoldingModal
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditing(null); }}
        onAdd={handleAddHolding}
        editing={editing}
      />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PortfolioDetailPage.jsx frontend/src/components/portfolio/PortfolioHeader.jsx frontend/src/components/portfolio/HoldingsTable.jsx frontend/src/components/portfolio/AddHoldingModal.jsx
git commit -m "feat: add portfolio detail page with holdings table and add/edit modals"
```

---

### Task 7: P&L Chart & Allocation Donut

**Files:**
- Create: `frontend/src/components/portfolio/PnLChart.jsx`
- Create: `frontend/src/components/portfolio/AllocationChart.jsx`
- Modify: `frontend/src/pages/PortfolioDetailPage.jsx` (add charts)

- [ ] **Step 1: Create PnLChart**

Create `frontend/src/components/portfolio/PnLChart.jsx`:

```jsx
import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import api from "../../lib/api";

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "All", days: "all" },
];

export default function PnLChart({ portfolioId, liveData }) {
  const [range, setRange] = useState(RANGES[1]); // default 3M
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSnapshots = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/portfolio/${portfolioId}/snapshots?days=${range.days}`);
        setSnapshots(data);
      } catch {}
      setLoading(false);
    };
    fetchSnapshots();
  }, [portfolioId, range.days]);

  // Merge snapshots + today's live point
  const chartData = [
    ...snapshots.map((s) => ({
      date: s.snapshot_date,
      value: s.total_value,
      cost: s.total_cost,
      pnl: s.total_value - s.total_cost,
    })),
    ...(liveData && liveData.total_value > 0
      ? [{
          date: "Today",
          value: liveData.total_value,
          cost: liveData.total_cost,
          pnl: liveData.total_pnl,
        }]
      : []),
  ];

  const latestPnl = chartData.length > 0 ? chartData[chartData.length - 1]?.pnl : 0;
  const isPositive = latestPnl >= 0;

  const formatDate = (d) => {
    if (d === "Today") return d;
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const fmt = (n) => n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pos = d.pnl >= 0;
    return (
      <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: 13 }}>
        <p style={{ margin: 0, color: "var(--text2)" }}>{d.date}</p>
        <p style={{ margin: "4px 0 0", color: "var(--text1)" }}>Value: ${fmt(d.value)}</p>
        <p style={{ margin: "2px 0 0", color: pos ? "var(--green)" : "var(--red)" }}>
          P&L: {pos ? "+" : ""}${fmt(d.pnl)}
        </p>
      </div>
    );
  };

  return (
    <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "var(--text1)" }}>Portfolio Performance</h3>
        <div style={{ display: "flex", gap: 4 }}>
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                background: range.label === r.label ? "var(--accent)" : "var(--surface2)",
                color: range.label === r.label ? "#fff" : "var(--text2)",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && chartData.length === 0 ? (
        <div style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)", fontSize: 14 }}>
          Loading chart data...
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ height: 250, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text2)", fontSize: 14 }}>
          No snapshot data yet. Performance history will appear after the first trading day.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? "var(--green)" : "var(--red)"} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isPositive ? "var(--green)" : "var(--red)"} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fill: "var(--text2)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text2)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            {chartData.some((d) => d.cost) && (
              <ReferenceLine y={chartData[0]?.cost} stroke="var(--text2)" strokeDasharray="4 4" strokeOpacity={0.5} />
            )}
            <Area type="monotone" dataKey="value" stroke={isPositive ? "var(--green)" : "var(--red)"} fill="url(#pnlGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create AllocationChart**

Create `frontend/src/components/portfolio/AllocationChart.jsx`:

```jsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = [
  "#6366f1", "#8b5cf6", "#a78bfa", "#c084fc",
  "#f472b6", "#fb7185", "#f87171", "#fb923c",
  "#fbbf24", "#34d399", "#2dd4bf", "#38bdf8",
  "#60a5fa", "#818cf8",
];

export default function AllocationChart({ holdings }) {
  if (!holdings || holdings.length === 0) return null;

  const data = holdings
    .filter((h) => h.market_value > 0)
    .sort((a, b) => b.market_value - a.market_value)
    .map((h) => ({
      name: h.ticker,
      value: h.market_value,
      weight: h.weight,
    }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: 13 }}>
        <p style={{ margin: 0, fontWeight: 600, color: "var(--text1)" }}>{d.name}</p>
        <p style={{ margin: "2px 0 0", color: "var(--text2)" }}>
          ${d.value.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({d.weight.toFixed(1)}%)
        </p>
      </div>
    );
  };

  return (
    <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
      <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text1)" }}>Allocation</h3>
      <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              dataKey="value"
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
          {data.map((d, i) => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />
              <span style={{ color: "var(--text1)", fontWeight: 500 }}>{d.name}</span>
              <span style={{ color: "var(--text2)" }}>{d.weight.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add charts to PortfolioDetailPage**

Open `frontend/src/pages/PortfolioDetailPage.jsx`. Add imports at top:

```javascript
import PnLChart from "../components/portfolio/PnLChart";
import AllocationChart from "../components/portfolio/AllocationChart";
```

In the return JSX, add after `<PortfolioHeader>` and before the "Add Holding" button div:

```jsx
<PnLChart portfolioId={id} liveData={liveData} />

<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
  <AllocationChart holdings={liveData?.holdings || []} />
</div>
```

Wrap the AllocationChart grid in a media query responsive style — on mobile (`max-width: 768px`) use `gridTemplateColumns: "1fr"`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/portfolio/PnLChart.jsx frontend/src/components/portfolio/AllocationChart.jsx frontend/src/pages/PortfolioDetailPage.jsx
git commit -m "feat: add P&L line chart and allocation donut to portfolio detail"
```

---

## Chunk 3: Polish & Deploy

### Task 8: Mobile Navigation

**Files:**
- Modify: `frontend/src/layouts/AppLayout.jsx` (add Portfolio to MobileNav if it exists there)

- [ ] **Step 1: Check for MobileNav component**

Search for MobileNav in `frontend/src/layouts/AppLayout.jsx` or `frontend/src/components/`. If a bottom mobile nav exists, add a Portfolio icon entry matching the existing pattern (same icon SVG as Sidebar).

- [ ] **Step 2: Commit if changes were made**

```bash
git add frontend/src/layouts/AppLayout.jsx
git commit -m "feat: add portfolio to mobile navigation"
```

---

### Task 9: Manual Testing

- [ ] **Step 1: Run the backend locally**

```bash
cd backend
FINNHUB_KEY=... SUPABASE_URL=... SUPABASE_KEY=... uvicorn main:app --reload --port 8000
```

- [ ] **Step 2: Run the frontend locally**

```bash
cd frontend
npm run dev
```

- [ ] **Step 3: Test portfolio CRUD via Swagger UI**

Open `http://localhost:8000/docs`. Test each endpoint:
1. `POST /portfolio` with `{"name": "Test Portfolio"}` — expect 200 with portfolio object
2. `GET /portfolio` — expect the created portfolio in list
3. `POST /portfolio/{id}/holdings` with `{"ticker": "AAPL", "shares": 10, "avg_price": 180}` — expect 200
4. `GET /portfolio/{id}/live` — expect holdings with P&L calculations
5. `PUT /portfolio/{id}/holdings/{holding_id}` with `{"shares": 20}` — expect updated
6. `DELETE /portfolio/{id}/holdings/{holding_id}` — expect `{"ok": true}`
7. `GET /portfolio/{id}/snapshots` — expect empty array (no snapshots yet)
8. `DELETE /portfolio/{id}` — expect `{"ok": true}`

- [ ] **Step 4: Test frontend pages**

1. Navigate to `/portfolio` — see empty state with "Create Portfolio" button
2. Create a portfolio — see it appear in the grid
3. Click into it — see detail page with empty holdings
4. Add AAPL holding — see it in the table with live P&L
5. Edit the holding — change shares, verify update
6. Check P&L chart — should show "No snapshot data yet" message + today's live point
7. Delete the holding — verify removal
8. Delete the portfolio — verify redirect to list
9. Test mobile viewport (390px) — holdings should show as cards

- [ ] **Step 5: Test tier limits**

1. As a free user, create 1 portfolio — should succeed
2. Try to create a 2nd — should see "Portfolio limit reached" error
3. Add 5 holdings — should succeed
4. Try to add a 6th — should see "Holding limit reached" error

---

### Task 10: Build & Deploy

- [ ] **Step 1: Verify frontend build**

```bash
cd frontend
npm run build
```

Ensure no build errors. Check that `PortfolioListPage` and `PortfolioDetailPage` appear as separate chunks in the output.

- [ ] **Step 2: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete portfolio tracking feature"
```

- [ ] **Step 3: Push to deploy**

```bash
git push origin main
```

This triggers:
- Vercel auto-deploys the frontend
- Render auto-deploys the backend (if configured)

- [ ] **Step 4: Run the migration SQL in production Supabase**

Go to production Supabase Dashboard → SQL Editor → paste and run `backend/migrations/003_portfolio_tables.sql`.

- [ ] **Step 5: Add `SUPABASE_SERVICE_KEY` GitHub Secret**

Go to GitHub repo → Settings → Secrets → New: `SUPABASE_SERVICE_KEY` = the service_role key from Supabase Dashboard → Settings → API.

- [ ] **Step 6: Verify on production**

1. Visit `https://equityvalue.ai/portfolio`
2. Log in, create a portfolio, add holdings
3. Verify P&L calculations look correct
4. Check mobile view
