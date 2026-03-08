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
| `GET /search/{query}` | Ticker autocomplete via yfinance |
| `POST /pdf/export` | Generate PDF report via reportlab |
| `GET /cache/clear` | Flush in-memory cache |

### Supabase schema
Table: `stock_fundamentals`. Key column name differences from internal field names:
- DB `week_52_high` / `week_52_low` → internal `52w_high` / `52w_low`
- DB `current_price` is a cached snapshot; always overridden by live Finnhub price

### Required environment variables
- `FINNHUB_KEY` — live price, candles, fundamentals fallback
- `ANTHROPIC_API_KEY` — AI memo generation (`/thesis` and `/ai/thesis` endpoints)
- `SUPABASE_URL` / `SUPABASE_KEY` — default to hardcoded values in `data_fetcher.py` if not set

### Deployment
- Frontend → Vercel (root: `frontend`). `VITE_API_URL` in `.env.production` points to the Render backend URL.
- Backend → Render (root: `backend`, start: `uvicorn main:app --host 0.0.0.0 --port $PORT`). Set all three env vars in Render dashboard.
- In-memory cache (`_cache` dict in `main.py`) does not persist across Render restarts/instances.
