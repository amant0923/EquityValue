# Equity Value — Operational Runbooks

## System Architecture

**Stack:** FastAPI (Python) backend + React/Vite frontend + Supabase (Postgres) + Stripe billing.

**Deployment:**
- **Frontend:** Vercel (root: `frontend`). Env var `VITE_API_URL` points to the Render backend.
- **Backend:** Render (root: `backend`). Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- **Database:** Supabase hosted Postgres. All tables listed in `CLAUDE.md`.
- **Scheduled Jobs:** GitHub Actions for nightly EVS pipeline, weekly digest, and SEO page generation.

## Deployment

### Frontend (Vercel)
1. Push to `main` branch triggers automatic deploy.
2. Environment variables are set in the Vercel dashboard (`VITE_API_URL`).
3. Preview deploys are created for pull requests.

### Backend (Render)
1. Push to `main` branch triggers automatic deploy on Render.
2. Required env vars: `FINNHUB_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`, `STRIPE_*` keys, `SENTRY_DSN`.
3. In-memory cache does **not** persist across Render restarts.

### Quick Health Check
```bash
curl https://your-backend-url.onrender.com/health
```
Returns `{"status": "healthy", "database": "connected", ...}`.

## Runbooks

| Runbook | Purpose |
|---------|---------|
| [nightly-pipeline.md](nightly-pipeline.md) | EVS scoring pipeline (Mon-Fri 6am ET) |
| [data-refresh.md](data-refresh.md) | FMP data refresh scripts |
| [incident-response.md](incident-response.md) | What to do when things break |
