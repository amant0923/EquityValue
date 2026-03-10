# Portfolio Tracking Feature — Design Spec

**Date:** 2026-03-10
**Status:** Approved

## Overview

Allow users to manually input S&P 500 stock holdings (ticker, shares, avg purchase price) into named portfolios and track daily P&L. Portfolio value and P&L are recalculated from live market prices on every page refresh. Daily snapshots store historical values for a P&L line chart.

## Data Model

### `user_portfolios`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | gen_random_uuid() |
| user_id | UUID (FK → auth.users) | RLS enforced |
| name | text | max 50 chars |
| created_at | timestamptz | default now() |

### `portfolio_holdings`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | gen_random_uuid() |
| portfolio_id | UUID (FK → user_portfolios) | cascade delete |
| ticker | text | must exist in stock_fundamentals |
| shares | numeric | positive, > 0 |
| avg_price | numeric | positive, > 0 |
| added_at | timestamptz | default now() |
| updated_at | timestamptz | default now(), auto-update on edit |

Unique constraint: `(portfolio_id, ticker)` — no duplicate tickers per portfolio.

### `portfolio_snapshots`

| Column | Type | Notes |
|--------|------|-------|
| id | UUID (PK) | gen_random_uuid() |
| portfolio_id | UUID (FK → user_portfolios) | cascade delete |
| snapshot_date | date | market close date |
| total_value | numeric | sum(shares * closing_price) |
| total_cost | numeric | sum(shares * avg_price) |

Unique constraint: `(portfolio_id, snapshot_date)`

### RLS Policies (SQL)

```sql
-- user_portfolios: users can only access their own
ALTER TABLE user_portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_portfolios" ON user_portfolios
  FOR ALL USING (auth.uid() = user_id);

-- portfolio_holdings: access via portfolio ownership
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_holdings" ON portfolio_holdings
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM user_portfolios WHERE user_id = auth.uid())
  );

-- portfolio_snapshots: access via portfolio ownership
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_snapshots" ON portfolio_snapshots
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM user_portfolios WHERE user_id = auth.uid())
  );
```

## Tier Limits

| Tier | Portfolios | Holdings per portfolio |
|------|-----------|----------------------|
| Free | 1 | 5 |
| Pro | 5 | 25 |
| Max | Unlimited | Unlimited |

Tier limits enforced **server-side only** via a `PORTFOLIO_LIMITS` dict in `portfolio.py`. No `FREE_BLOCKED` entry needed — all users can access the portfolio page, but creation/addition is capped by plan. Frontend reads limits from a `GET /portfolio/limits` call or from the user profile.

## Backend API

New route file: `backend/routes/portfolio.py`. **All endpoints use `Depends(get_current_user)` from `auth.py`** — this is the first route file to require auth (existing route files in `routes/` are unauthenticated public data endpoints).

```python
from auth import get_current_user
# Every endpoint: user = Depends(get_current_user)
```

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/portfolio` | GET | List user's portfolios with holding counts |
| `/portfolio` | POST | Create portfolio `{name}` |
| `/portfolio/{id}` | DELETE | Delete portfolio (cascade) |
| `/portfolio/{id}/holdings` | GET | List holdings for portfolio |
| `/portfolio/{id}/holdings` | POST | Add holding `{ticker, shares, avg_price}` |
| `/portfolio/{id}/holdings/{holding_id}` | PUT | Edit holding `{shares?, avg_price?}` |
| `/portfolio/{id}/holdings/{holding_id}` | DELETE | Remove holding |
| `/portfolio/{id}/snapshots` | GET | Historical snapshots `?days=30|90|365|all` |
| `/portfolio/{id}/live` | GET | Current prices + per-holding P&L + totals |

### Validation rules

- `name`: 1-50 characters, trimmed
- `shares`: positive number, > 0
- `avg_price`: positive number, > 0
- `ticker`: must exist in `stock_fundamentals` table (S&P 500 only)
- No duplicate tickers within a portfolio (unique constraint)
- Tier limits checked on POST portfolio (count existing) and POST holding (count existing in portfolio)

### `/live` endpoint price source

Fetches current prices from `stock_fundamentals.current_price` (updated by daily FMP refresh). These are daily-close prices, not intraday. This is acceptable for a portfolio tracker — truly live Finnhub calls per-ticker would be too slow for portfolios with many holdings.

## Frontend

### Routes

| Path | Page | Description |
|------|------|-------------|
| `/portfolio` | PortfolioListPage | Grid of portfolio cards |
| `/portfolio/:id` | PortfolioDetailPage | Full portfolio view |

### Navigation integration

- **Sidebar.jsx**: Add `{ id: "portfolio", label: "Portfolio", icon: PieChart }` to `NAV` array
- **AppLayout.jsx**: Add `else if (p === "portfolio") navigate("/portfolio")` to `handlePageChange`
- **AppLayout.jsx**: Add `portfolio: "Portfolio"` to breadcrumb map
- **MobileNav**: Add Portfolio icon to mobile bottom nav
- **App.jsx**: Add lazy imports and routes for both pages

### PortfolioListPage (`/portfolio`)

- Grid of `PortfolioCard` components: name, total value, daily P&L ($ and %), holding count
- "Create Portfolio" button → `CreatePortfolioModal` (name input)
- Free users see upgrade prompt when at portfolio limit
- **Empty state**: illustration + "Create your first portfolio" CTA when no portfolios exist

### PortfolioDetailPage (`/portfolio/:id`)

- **PortfolioHeader** — portfolio name, total value, total P&L ($ and %), cost basis
- **PnLChart** — Recharts area chart with time range toggles (1M / 3M / 1Y / All). Combines stored snapshots (historical) + live point (today). Green fill above cost basis, red below.
- **HoldingsTable** — sortable columns: Ticker, Shares, Avg Price, Current Price, Market Value, P&L ($), P&L (%), Weight (%). Edit/delete actions per row. Stacks to cards on mobile.
- **AllocationChart** — Recharts donut chart showing portfolio weighting by stock
- **AddHoldingModal** — reuses existing SearchBar for ticker lookup, inputs for shares and avg price
- **Loading state**: skeleton loaders consistent with existing `SkeletonLoader` patterns
- **Error state**: retry button if `/live` endpoint fails

### Components (in `frontend/src/components/portfolio/`)

| Component | Purpose |
|-----------|---------|
| PortfolioCard | Card on list page |
| PortfolioHeader | Value/P&L summary bar |
| PnLChart | Area line chart with time toggles |
| HoldingsTable | Sortable table with edit/delete |
| AllocationChart | Donut chart of weights |
| AddHoldingModal | Ticker search + shares + price form |
| CreatePortfolioModal | Name input modal |

Styled with existing glass-card, dark theme, CSS variable patterns. Mobile responsive.

## P&L Calculation

On every page load/refresh:

1. Fetch holdings from backend
2. Fetch live prices via `GET /portfolio/{id}/live`
3. Per holding: `pnl = shares * (current_price - avg_price)`
4. Per holding: `pnl_pct = (current_price - avg_price) / avg_price * 100`
5. Per holding: `weight = (shares * current_price) / total_value * 100`
6. Total: `total_value = sum(shares * current_price)`
7. Total: `total_cost = sum(shares * avg_price)`
8. Total: `total_pnl = total_value - total_cost`

No caching — always recalculated from current prices on page load.

## Daily Snapshot Job

**GitHub Actions workflow:** `.github/workflows/portfolio-snapshots.yml`
**Script:** `backend/snapshot_portfolios.py`
**Schedule:** `cron: '30 21 * * 1-5'` (Mon-Fri only, 9:30 PM UTC, after US market close)

Flow:
1. Connect to Supabase using **service_role key** (bypasses RLS to read all users' data)
2. Query all `portfolio_holdings` joined with `user_portfolios`
3. Collect unique tickers across all portfolios
4. FMP bulk quote API call for closing prices
5. Compute `total_value` and `total_cost` per portfolio
6. Upsert into `portfolio_snapshots` (unique on portfolio_id + snapshot_date)

**Required GitHub Secret:** `SUPABASE_SERVICE_KEY` (service_role key, not the anon key). The anon key cannot bypass RLS to read all users' portfolios.

Also uses existing secrets: `SUPABASE_URL`, `FMP_KEY`.

## Architecture Decisions

- **Server-side P&L via `/live` endpoint** — backend fetches prices and returns calculated P&L, frontend renders
- **Manual entry only** — no CSV import or broker integration (YAGNI)
- **Shares only** — no CFDs, options, or dollar-amount positions
- **Daily-close prices** — `stock_fundamentals.current_price` updated by FMP daily refresh, not intraday Finnhub
- **Single bulk quote** for snapshots — one FMP API call regardless of user count
- **No data retention limit** — lightweight for Postgres at expected scale
- **Auth on route file** — first `routes/` file to use `Depends(get_current_user)`, since portfolio data is private (unlike public financial data endpoints)
- **Service_role key for cron** — snapshot job needs cross-user access, bypasses RLS
