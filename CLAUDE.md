# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
FINNHUB_KEY=... ANTHROPIC_API_KEY=... uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build
npm run preview    # preview production build
```

### Data / Supabase
```bash
# Re-fetch missing tickers from FMP and upsert to Supabase
cd backend
FMP_KEY=... python3 fetch_missing.py
```

## Architecture

**Stack:** FastAPI backend + React/Vite frontend. No test suite.

### Data flow
Every valuation request goes through three layers:
1. **`data_fetcher.py`** — fetches raw data. Priority order:
   - Fundamentals: Supabase `stock_fundamentals` table first; falls back to Finnhub + yfinance if no row found
   - Live price: always fetched fresh from Finnhub (overrides Supabase cached price)
   - Price history: yfinance primary, Finnhub candles as fallback
2. **`main.py` `normalise()`** — maps field names for the valuation models (`current_price→price`, `total_cash→cash`, `book_value→book_value_per_share`, computes derived fields like `ev_ebitda` and `ebitda_margin`)
3. **`valuation/router.py` `run_valuation()`** — classifies company type, runs the appropriate model subset, computes consensus

### Company classification → model selection
`classifier.py` maps a stock to one of five types: `dividend`, `profitable_growth`, `high_growth_unprofitable`, `cyclical`, `financial`. `router.py`'s `MODEL_MAP` dict selects which valuation functions run for each type.

### Valuation models
All 11 models live in `valuation/models.py`. Each returns a dict with `applicable`, `intrinsic_value`, `verdict`, `upside_pct`, and `assumptions`. The consensus excludes "outlier" models (DDM, Graham Number, Residual Income, Cap of Earnings) — only market-based models feed the consensus price target.

### Backend API endpoints
| Endpoint | Purpose |
|----------|---------|
| `GET /valuation/{ticker}` | Full valuation (cached 1hr in-memory) |
| `GET /history/{ticker}?period=1y` | Price history |
| `GET /comps/{ticker}` | Sector peer comparison |
| `POST /thesis/{ticker}` | Claude AI investment memo (cached) |
| `POST /ai/thesis` | Streaming Claude response (SSE) |
| `GET /search/{query}` | Ticker autocomplete via Supabase |
| `POST /pdf/export` | Generate PDF report via reportlab |
| `GET /cache/clear` | Flush in-memory cache |
| `GET /summary/{ticker}` | Combined summary (fundamentals + metrics + analyst + scores + growth) |
| `GET /financials/{ticker}?period=annual\|quarterly` | All 3 financial statements |
| `GET /financials/{ticker}/growth` | Growth metrics |
| `GET /metrics/{ticker}?period=annual\|quarterly` | Key metrics (valuation ratios, efficiency) |
| `GET /segments/{ticker}` | Revenue segments (product + geographic) |
| `GET /analyst/{ticker}` | Analyst ratings, price targets, recent grades |
| `GET /insider/{ticker}` | Insider trades + senate trades |
| `GET /earnings/{ticker}` | Earnings history (EPS actual vs estimate) |
| `GET /dividends/{ticker}` | Dividends history |
| `GET /scores/{ticker}` | Financial scores (Altman Z, Piotroski, DCF values) |

### Supabase schema
**Core table:** `stock_fundamentals` — S&P 500 company basics (cached from FMP).

**Company deep dive tables** (populated by refresh scripts via FMP API):
| Table | Key Fields | Refresh |
|-------|-----------|---------|
| `financial_statements` | ticker, period_date, period_type, statement_type + all line items | Quarterly |
| `key_metrics` | ticker, period_date, period_type + 60+ valuation/efficiency ratios | Weekly |
| `growth_metrics` | ticker, period_date, period_type + revenue/EPS/FCF growth rates | Weekly |
| `analyst_data` | ticker + ratings, price targets, recent_grades (JSONB) | Daily |
| `insider_trades` | ticker, filing_date, reporter_name, shares_traded, price | Daily |
| `earnings_history` | ticker, date, eps_actual, eps_estimate, eps_surprise | Quarterly |
| `dividends_history` | ticker, ex_date, amount, yield, frequency | Weekly |
| `revenue_segments` | ticker, period_date, segment_type, segment_name, revenue | Weekly |
| `company_scores` | ticker, altman_z_score, piotroski_score, dcf_value | Daily |
| `senate_trades` | ticker, senator_name, party, transaction_type, amount_range | Daily |

### FMP data refresh pipeline
Three Python scripts in `backend/` fetch from FMP API and upsert to Supabase:
- `refresh_quarterly.py` — financial statements + earnings (runs quarterly via GitHub Actions)
- `refresh_weekly.py` — key metrics, growth, dividends, segments (runs weekly)
- `refresh_daily.py` — analyst, insider, senate, scores (runs daily Mon-Fri)

All use `fmp_client.py` (shared rate-limited FMP client). GitHub Actions workflows in `.github/workflows/`.

### Frontend routing
React Router v6 (`react-router-dom`). Routes defined in `App.jsx`:
| Route | Component | Description |
|-------|-----------|-------------|
| `/` | LandingPage | Marketing landing page |
| `/dashboard` | DashboardPage | User dashboard with watchlist |
| `/screener` | ScreenerPage | S&P 500 stock screener |
| `/analysis` | AnalysisPage | Legacy analysis view (search + results) |
| `/company/:ticker` | CompanyPage | Company summary (deep dive landing) |
| `/company/:ticker/financials` | CompanyFinancialsPage | Financial statements + charts |
| `/company/:ticker/intelligence` | CompanyIntelligencePage | Analyst, insider, earnings data |
| `/company/:ticker/valuation` | CompanyValuationPage | Valuation models + DCF comparison |
| `/compare` | ComparePage | Side-by-side stock comparison (Pro) |

App shell layout in `layouts/AppLayout.jsx`. Company tab navigation in `components/company/CompanyNav.jsx`.

### Required environment variables
- `FINNHUB_KEY` — live price, candles, fundamentals fallback
- `ANTHROPIC_API_KEY` — AI memo generation (`/thesis` and `/ai/thesis` endpoints)
- `SUPABASE_URL` / `SUPABASE_KEY` — default to hardcoded values in `data_fetcher.py` if not set
- `FMP_KEY` — FMP API key (used by refresh scripts and GitHub Actions only)

### Deployment
- Frontend → Vercel (root: `frontend`). `VITE_API_URL` in `.env.production` points to the Render backend URL.
- Backend → Render (root: `backend`, start: `uvicorn main:app --host 0.0.0.0 --port $PORT`). Set all three env vars in Render dashboard.
- In-memory cache (`_cache` dict in `main.py`) does not persist across Render restarts/instances.
