# Equity Value: Market Viability Improvements Design

**Date:** 2026-03-14
**Goal:** Move Equity Value from ~5/10 to 9/10 on market viability assessment
**Timeline:** 8 weeks in two phases (Phase 1: 4 weeks, Phase 2: 4 weeks)
**Approach:** Proprietary Score (EVS) + Backtested Accuracy + Retention Hooks

### Phasing

- **Phase 1 (Weeks 1-4):** EVS score algorithm + nightly computation + company page integration + `/evs/top` public page + annual billing + security hardening + disclaimers. Delivers a shippable milestone with the core differentiator live.
- **Phase 2 (Weeks 5-8):** Accuracy tracking + alerts + email (Resend) + weekly digest + full programmatic SEO pages + cost dashboard + free tier rebalancing.

### Prerequisites

- **Resend account** + `RESEND_API_KEY` env var (for Phase 2 email features)
- **Two new Stripe Price IDs** for annual Pro/Max variants
- **Stripe Customer Portal** enabled for plan management/upgrades
- Unit tests for EVS computation and accuracy calculations (these are the highest-leverage tests since errors directly undermine the product's core value)

---

## Current Viability Scores

| # | Dimension | Current | Target | Key Gap |
|---|-----------|---------|--------|---------|
| 1 | Market Definition & Sizing | 6 | 8 | S&P 500 only, no SEO visibility |
| 2 | Competitive Landscape | 5 | 9 | No unique positioning vs competitors |
| 3 | Product-Market Fit | 6 | 9 | No retention hooks, weak daily engagement |
| 4 | Unit Economics | 5 | 8 | No annual billing, unoptimized AI costs |
| 5 | Moat & Defensibility | 4 | 9 | No proprietary data/scoring, no switching costs |
| 6 | Strategic Threats | 5 | 8 | AI commoditization unaddressed |
| 7 | Strategic Recommendations | N/A | N/A | This document |
| 8 | Verification & Confidence | 5 | 9 | No backtested accuracy data |

---

## Section 1: Equity Value Score (EVS) — The Proprietary Moat

### What it is
A 1-100 composite score for every S&P 500 stock, computed from existing valuation models, analyst data, financial health signals, and contextual risk factors.

### Score Composition

| Component | Weight | Source | What it measures |
|-----------|--------|--------|-----------------|
| Valuation | 35% | Consensus upside from weighted models | Is it cheap relative to intrinsic value? |
| Financial Health | 20% | Altman Z, Piotroski, debt ratios, margins | Can the company sustain/grow? |
| Analyst Alignment | 15% | Model consensus vs analyst targets | Do the pros agree with our models? |
| Growth Quality | 15% | Revenue growth, EPS growth, FCF growth trends | Is growth real and sustainable? |
| Risk Signals | 15% | Contextual signals (52w position, earnings smoothing, asset quality) | Red flags that discount the score |

### Score Ranges
- 80-100: Strong Buy — significant undervaluation + healthy fundamentals
- 60-79: Buy — moderate upside with acceptable risk
- 40-59: Hold — fairly valued or mixed signals
- 20-39: Sell — overvalued or deteriorating fundamentals
- 0-19: Strong Sell — significant overvaluation + red flags

### Backtesting

**Important: Initial backtests are retrospective simulations, not tracked live predictions.**

The EVS formula can be partially reconstructed from historical Supabase data:
- **Reconstructable (historical data exists):** Financial Health (Altman Z, Piotroski from `company_scores`), Growth Quality (from `growth_metrics`), Valuation multiples (from `key_metrics`, `financial_statements`)
- **Not reconstructable:** Analyst Alignment at the historical date (only current analyst data stored), real-time price-based Risk Signals at the historical date

Approach: Compute a partial historical EVS using the reconstructable components (70% of the score weight), disclose the methodology transparently. Real out-of-sample accuracy tracking begins at launch from daily snapshots going forward. After 6 months of live tracking, switch published stats to real tracked accuracy.

### Backend
- New endpoint: `GET /evs/{ticker}` — returns EVS breakdown (note: `/scores/{ticker}` already exists for Altman Z/Piotroski)
- New endpoint: `GET /evs/top` — top 20 highest-scoring stocks (public, SEO-friendly)
- Nightly GitHub Action computes EVS for all 500 tickers
- New Supabase table: `equity_value_scores` (ticker: text PK, score: integer 0-100, valuation_score: float, health_score: float, analyst_score: float, growth_score: float, risk_score: float, verdict: text, components: jsonb, computed_at: timestamptz)
- New Supabase table: `equity_value_score_history` (id: serial, ticker: text, score: integer, verdict: text, computed_at: timestamptz, unique on (ticker, computed_at::date))

### Frontend
- Large circular score badge on every company page (hero element)
- Score breakdown accordion (click to see each component)
- Score history sparkline (30/90/365 day trends)
- Landing page: "See every S&P 500 stock scored 1-100" with top picks preview

### Free vs Pro Gate
- Free: See score number + verdict. See top 10 highest/lowest scores.
- Pro: Full breakdown, score history, score alerts, screener filter by score range.

---

## Section 2: Backtested Accuracy & Model Transparency

### Model Accuracy Tracking

Every valuation run snapshots the verdict + intrinsic value + date into a `valuation_snapshots` table. A nightly job compares past snapshots to actual price movements:
- "6 months ago, our DCF said AAPL was worth $210 (Undervalued at $175). AAPL is now $205. DCF was within 3%."
- Aggregate accuracy per model: "FCF Yield: 74% accuracy (best performing model)"

### Accuracy Dashboard (new page: /accuracy)

| Section | Content |
|---------|---------|
| Model Leaderboard | Table ranking all 12 models by hit rate (% correct directional calls over 6/12 months) |
| Score Accuracy | "Stocks with EVS 80+ returned avg X% over 12 months" |
| Recent Calls | Feed of past verdicts with outcomes |
| Methodology | Plain-English explanation of each model |

### Backend
- New table: `valuation_snapshots` (ticker, date, model_name, intrinsic_value, verdict, price_at_snapshot)
- New table: `accuracy_tracking` (ticker, snapshot_date, model_name, intrinsic_value, price_at_snapshot, price_6mo, price_12mo, direction_correct_6mo, direction_correct_12mo)
- Nightly GitHub Action: snapshot valuations, backfill accuracy for 6/12 month marks
- New endpoints: `GET /accuracy/models`, `GET /accuracy/score`, `GET /accuracy/{ticker}`

### Free vs Pro Gate
- Free: Aggregate model accuracy stats + methodology page (SEO magnet)
- Pro: Per-ticker accuracy, sector breakdowns, model-level filtering

### Viability Impact
- Moat: Accuracy data compounds over time — new competitors have zero history
- Trust: Showing accuracy (including failures) builds credibility
- SEO: "Is DCF analysis accurate?" is a high-intent query answered with real data
- AI Defense: ChatGPT cannot track whether its DCFs were accurate over 12 months

---

## Section 3: Retention & Engagement

### 3A: Score Change Alerts

Trigger conditions:
- EVS crosses threshold (drops below 40 or rises above 80)
- EVS changes by 10+ points in a week
- Verdict flips (Undervalued to Overvalued or vice versa)
- Analyst consensus shifts (upgrade/downgrade wave)

Delivery: Email (Resend) + in-app notification bell.

Backend:
- New table: `user_alerts` (id: serial, user_id: UUID references user_profiles.id, ticker: text, alert_type: text enum('score_threshold','score_change','verdict_flip','analyst_shift'), threshold: integer nullable, enabled: boolean default true, created_at: timestamptz)
- New table: `alert_history` (id: serial, user_id: UUID references user_profiles.id, ticker: text, alert_type: text, triggered_at: timestamptz, message: text, read: boolean default false)
- Nightly job diffs EVS, fires matching alerts
- New endpoints: `POST /alerts/subscribe`, `GET /alerts/history`, `PUT /alerts/{id}/read`

Frontend:
- Bell icon in nav bar with unread count
- Alert preferences per stock on company page
- Alert history dropdown/page

### 3B: Weekly Digest Email

Auto-generated content (zero manual work):
- "Your Watchlist This Week" — score changes for watched stocks
- "Top 5 Most Undervalued" — highest EVS stocks this week
- "Biggest Score Movers" — largest EVS changes (up and down)
- "New Analyst Activity" — upgrades/downgrades on watched stocks

Implementation:
- GitHub Actions cron (Sunday evening)
- Template in backend, sends via Resend API
- Free users get stripped version (top 3 only, no watchlist — conversion hook)

### 3C: Enhanced Watchlist

Improvements:
- EVS badge next to each watched stock
- Sort by score, score change, upside
- "Score changed" indicator for stocks that moved since last visit
- Quick-add star/bookmark from any company page
- Limits: Free = 5 stocks, Pro = 50, Max = unlimited

---

## Section 4: Pricing & Unit Economics Optimization

### 4A: Annual Billing

| Plan | Monthly | Annual (20% off) | Annual Monthly Equiv |
|------|---------|-------------------|---------------------|
| Pro | $30/mo | $288/yr | $24/mo |
| Max | $50/mo | $480/yr | $40/mo |

Implementation:
- Two new Stripe Price IDs (annual variants): `STRIPE_PRO_ANNUAL_PRICE_ID`, `STRIPE_MAX_ANNUAL_PRICE_ID`
- Update `stripe_handler.py` `price_id_to_plan` dict to map 4 price IDs (pro, pro_annual, max, max_annual) all to their respective plan names
- Monthly/Annual toggle on pricing page and upgrade modal (default: Annual with "Save 20%" badge)
- Enable Stripe Customer Portal for self-service plan management (upgrade/downgrade/cancel)
- Existing monthly subscribers see an in-app banner offering annual switch with proration handled by Stripe

### 4B: AI Cost Optimization

- Shared thesis cache per ticker for 24 hours (not per user)
- Tiered AI model: Haiku for free-tier previews, Sonnet for Pro full thesis
- Precompute thesis for top 50 most-analyzed tickers nightly
- Estimated savings: 60-80% reduction in AI API costs at scale

### 4C: Cost Tracking

Admin-only dashboard:
- API call counts per day (Finnhub, FMP, Anthropic)
- Estimated cost per endpoint
- Cost per user (total API costs / active users)
- New table: `api_usage_log`

### 4D: Free Tier Rebalancing

- Increase from 1 to 3 analyses/day (builds habit, more conversion opportunities)
- Gate EVS breakdown (show score free, breakdown is Pro)
- Gate score history chart (Pro only)
- Gate per-ticker accuracy (Pro only)
- Keep AI thesis, Monte Carlo, LBO, PDF as Pro gates

---

## Section 5: Programmatic SEO & Public Pages

### 5A: Public Stock Score Pages

Route: `/stocks/{ticker}` (public, no auth, server-rendered)

Content per page:
- EVS score badge + verdict
- Company name, sector, current price, 52w range
- Consensus intrinsic value + upside % (teaser)
- 2-3 model previews (blurred after that)
- Model accuracy stat for this ticker
- CTA: "Sign up free to see all 12 models"

SEO elements:
- Title: `{TICKER} Valuation & Intrinsic Value | Equity Value Score: {SCORE}/100`
- Meta description with company name, verdict, score, intrinsic value
- JSON-LD structured data
- Open Graph tags for social sharing
- Updated daily

### 5B: Index Pages

| Page | Route | Content |
|------|-------|---------|
| All Scores | /stocks | Sortable table of all 500 stocks with EVS |
| Top Undervalued | /stocks/undervalued | Top 20 highest-scoring stocks |
| Top Overvalued | /stocks/overvalued | Bottom 20 lowest-scoring stocks |
| By Sector | /stocks/sector/{sector} | Filtered by sector with avg score |
| Accuracy | /accuracy | Aggregate model accuracy + methodology |

### 5C: Implementation

**Approach: Python/Jinja2 static generator + Vercel rewrites** (avoids Next.js migration).

The React/Vite SPA cannot do server-side rendering. Instead, use a separate lightweight static site generator:

1. **`backend/seo_generator.py`** — Python script using Jinja2 templates
   - Reads EVS scores + company data from Supabase
   - Generates self-contained HTML files (inline CSS, no React dependency) for each `/stocks/{ticker}` page and index pages
   - Outputs to `frontend/public/stocks/` directory
   - Each page includes: meta tags, JSON-LD, Open Graph, minimal inline CSS, and a CTA linking to the main app (`/company/{ticker}`)

2. **Vercel `vercel.json` rewrites:**
   - `/stocks/*` serves the pre-built static HTML files
   - All other routes serve the React SPA as before
   - This keeps the two systems cleanly separated

3. **Nightly GitHub Action** runs `seo_generator.py`, commits updated HTML to repo, triggers Vercel redeploy

4. **Why not Astro/Eleventy:** Adding a JS build tool creates a dependency to maintain. Python/Jinja2 is already in the stack, runs in GitHub Actions natively, and produces plain HTML that needs no build step.

### 5D: Target Keywords

| Pattern | Monthly Search Vol (est.) | Competition |
|---------|--------------------------|-------------|
| {TICKER} valuation | 500-5,000/ticker | Medium |
| {TICKER} intrinsic value | 200-2,000/ticker | Low-Medium |
| {TICKER} overvalued or undervalued | 100-1,000/ticker | Low |
| stock valuation tool | 2,000-5,000 | High |

500 tickers at modest rankings = 10K-50K organic visits/month within 6-12 months.

---

## Section 6: Risk Mitigation & Regulatory

### 6A: AI Commoditization Defense

Defense layers:
1. Tracked accuracy — ChatGPT cannot show historical prediction accuracy
2. Persistent scoring — EVS tracks over time, alerts on changes
3. Interactive tools — DCF sensitivity, Monte Carlo are interactive, not static text
4. Data pipeline — Daily/weekly/quarterly refresh vs stale training data
5. PDF reports — Institutional-quality shareable output

Positioning: "ChatGPT can give you a stock opinion. We give you a scored, tracked, backtested valuation system that tells you when it's wrong."

### 6B: Data Provider Diversification

- Add yfinance as automated fallback in refresh scripts
- Store raw API responses with `source` column
- Add `data_freshness` field to API responses
- Monitor FMP API status, admin alert if >10% tickers fail

### 6C: Regulatory Disclaimers

Required disclaimers:
- Site-wide footer: educational tool, not investment advice
- AI thesis: generated by AI, not reviewed by human analyst
- EVS badge tooltip: quantitative model output, not a recommendation
- Terms of Service: financial information and educational tools, not advice

### 6D: Security Hardening

| Issue | Fix |
|-------|-----|
| Hardcoded admin credentials | Move to env vars |
| Supabase anon key in source | Move to env vars |
| No rate limiting | Add slowapi: 60 req/min by IP for unauthenticated/public routes, 60 req/min for free users by user_id, 300 req/min for Pro/Max by user_id |
| No input validation on screener | Add Pydantic models |

### 6E: Solo Founder Risk Mitigations

- Everything automated (nightly scores, weekly digest, refresh pipelines)
- No community moderation burden
- AI thesis cached/precomputed
- Stripe handles billing
- Supabase handles auth
- Codebase is documented and handoff-ready

---

## New Database Tables Summary

| Table | Purpose | Retention |
|-------|---------|-----------|
| `equity_value_scores` | EVS score + components per ticker, computed nightly | Current only (overwritten) |
| `equity_value_score_history` | Historical EVS for sparklines and backtesting | Indefinite (compounds value) |
| `valuation_snapshots` | Daily snapshot of model outputs for accuracy tracking | Indefinite (compounds value) |
| `accuracy_tracking` | 6/12 month accuracy results per model per ticker | Indefinite (compounds value) |
| `user_alerts` | User alert subscriptions (ticker, type, threshold) | Until user deletes |
| `alert_history` | Triggered alert log with read/unread status | 90 days (nightly cleanup) |
| `api_usage_log` | API call counts and costs (endpoint: text, method: text, user_id: UUID nullable, timestamp: timestamptz, response_time_ms: integer, estimated_cost: float) | 90 days (aggregate to daily summaries, prune raw rows) |

## New API Endpoints Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/evs/{ticker}` | GET | Optional | EVS score + breakdown |
| `/evs/top` | GET | None | Top 20 scores (public/SEO) |
| `/evs/bottom` | GET | None | Bottom 20 scores (public/SEO) |
| `/accuracy/models` | GET | None | Model accuracy leaderboard (public/SEO) |
| `/accuracy/score` | GET | None | EVS backtest results |
| `/accuracy/{ticker}` | GET | JWT | Per-ticker accuracy (Pro) |
| `/alerts/subscribe` | POST | JWT | Create alert subscription |
| `/alerts/history` | GET | JWT | User alert history |
| `/alerts/{id}/read` | PUT | JWT | Mark alert as read |

## New GitHub Actions

3 new workflows (in addition to existing daily/weekly/quarterly refresh, portfolio-snapshots, and keep-alive):

| Action | Schedule | Steps (sequential within workflow) |
|--------|----------|------------------------------------|
| `nightly-evs-pipeline.yml` | Daily 6am ET (Mon-Fri) | 1. Compute EVS for 500 tickers → 2. Snapshot valuations → 3. Backfill accuracy for aged snapshots → 4. Diff EVS & fire alerts. **Failure handling:** Each step commits partial results before proceeding. If step N fails, steps N+1 still run on stale data. Failures logged to `api_usage_log` with alert to admin email. |
| `weekly-digest.yml` | Sunday 6pm ET | Send weekly digest emails via Resend |
| `generate-seo-pages.yml` | Daily 10am ET | Run `seo_generator.py`, commit HTML, trigger Vercel redeploy |

Estimated GitHub Actions usage: ~15 min/day for EVS pipeline (500 tickers), ~5 min for SEO generation. Well within free tier (2,000 min/month).

## Projected Viability Scores After Implementation

| # | Dimension | Before | After | Key Driver |
|---|-----------|--------|-------|------------|
| 1 | Market Definition & Sizing | 6 | 8 | Programmatic SEO proves addressable market |
| 2 | Competitive Landscape | 5 | 9 | EVS + accuracy = unique positioning |
| 3 | Product-Market Fit | 6 | 9 | Score + alerts + digest = daily retention |
| 4 | Unit Economics | 5 | 8 | Annual billing + AI cost optimization |
| 5 | Moat & Defensibility | 4 | 9 | EVS proprietary, accuracy compounds, switching costs |
| 6 | Strategic Threats | 5 | 8 | AI defense, data diversification, regulatory |
| 7 | Strategic Recommendations | N/A | N/A | This document |
| 8 | Verification & Confidence | 5 | 9 | Backtested accuracy is literally this dimension |
| **Overall** | | **~5** | **~8.7** | |
