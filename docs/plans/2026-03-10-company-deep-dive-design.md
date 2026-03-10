# Company Deep Dive — Design Document

**Date:** 2026-03-10
**Status:** Approved

## Goal

Transform the single-page stock analysis into a multi-page company deep dive with full financial statements (quarterly + annual), company intelligence (analyst, insider, earnings), and valuation modelling — all powered by the FMP Starter subscription and stored in Supabase.

## Principles

- All FMP data stored in Supabase, refreshed on schedule — zero FMP calls at runtime
- Live price continues from Finnhub, price history from yfinance
- Institutional-quality charts everywhere using Recharts
- Existing features (valuation models, AI thesis, Monte Carlo, LBO) preserved and reorganized

---

## 1. Data Layer — Supabase Schema

### New Tables

| Table | Key Columns | Rows/Company | Refresh |
|---|---|---|---|
| `financial_statements` | `ticker`, `period_date`, `period_type` (Q1/Q2/Q3/Q4/FY), `statement_type` (income/balance/cashflow), + all line items | ~24 | Quarterly |
| `key_metrics` | `ticker`, `period_date`, `period_type`, + metrics (PE, PB, ROE, ROA, margins, etc.) | ~24 | Weekly |
| `growth_metrics` | `ticker`, `period_date`, `period_type`, + growth rates per statement | ~24 | Weekly |
| `analyst_data` | `ticker`, `date`, rating distribution, price targets, grades | ~1 (latest) | Daily |
| `insider_trades` | `ticker`, `date`, `name`, `title`, `transaction_type`, `shares`, `value` | Variable | Daily |
| `earnings_history` | `ticker`, `date`, `eps_actual`, `eps_estimate`, `surprise_pct`, `revenue_actual`, `revenue_estimate` | ~20 | Quarterly |
| `dividends_history` | `ticker`, `ex_date`, `pay_date`, `amount`, `yield` | Variable | Weekly |
| `revenue_segments` | `ticker`, `year`, `segment_type` (product/geographic), `segment_name`, `revenue` | ~5 annual | Quarterly |
| `company_scores` | `ticker`, `date`, `altman_z`, `piotroski`, `dcf_value`, `owner_earnings` | ~1 | Weekly |
| `senate_trades` | `ticker`, `date`, `member`, `party`, `transaction_type`, `amount` | Variable | Daily |

Existing `stock_fundamentals` table unchanged — continues as latest snapshot for screener.

---

## 2. GitHub Actions Refresh Pipeline

Three scheduled workflows, all running Python scripts that fetch from FMP and upsert into Supabase.

| Workflow | Schedule | Tables Refreshed | Est. FMP Calls |
|---|---|---|---|
| `daily-refresh.yml` | Mon–Fri 9pm ET | `analyst_data`, `insider_trades`, `senate_trades`, `company_scores` | ~2,000 |
| `weekly-refresh.yml` | Sunday midnight | `key_metrics`, `growth_metrics`, `dividends_history`, `revenue_segments` | ~3,000 |
| `quarterly-refresh.yml` | Manual + 2nd week of Jan/Apr/Jul/Oct | `financial_statements`, `earnings_history` | ~2,000 |

All workflows:
- Use `FMP_KEY` and `SUPABASE_KEY` from GitHub Secrets
- Rate-limit at ~250 calls/min (under FMP's 300/min cap)
- Upsert (no duplicates)
- Log success/failure counts
- Can be manually triggered

---

## 3. Backend API — New Endpoints

All new endpoints read from Supabase only. JWT auth required. Existing endpoints unchanged.

| Endpoint | Purpose | Source Table |
|---|---|---|
| `GET /financials/{ticker}` | 3 statements, quarterly + annual, 5 years | `financial_statements` |
| `GET /financials/{ticker}/growth` | Growth rates across all statements | `growth_metrics` |
| `GET /metrics/{ticker}` | Key metrics + ratios, quarterly + annual | `key_metrics` |
| `GET /analyst/{ticker}` | Ratings, price targets, grades, estimates | `analyst_data` |
| `GET /insider/{ticker}` | Insider + senate trades | `insider_trades` + `senate_trades` |
| `GET /earnings/{ticker}` | EPS history, surprises | `earnings_history` |
| `GET /dividends/{ticker}` | Dividend history | `dividends_history` |
| `GET /segments/{ticker}` | Revenue by product + geography | `revenue_segments` |
| `GET /scores/{ticker}` | Financial scores, FMP DCF, owner earnings | `company_scores` |
| `GET /summary/{ticker}` | Combined summary (single call for Summary page) | All tables joined |

---

## 4. Frontend — Company Pages

Route structure: `/company/{ticker}` with tab navigation.

### Summary Page (landing — `/company/{ticker}`)

Order (top to bottom):

1. **Company Header** — price, change, market cap, sector, 52w range, beta + mini 30-day sparkline
2. **Valuation Verdict Card** — consensus price target, upside %, verdict badge + football field chart
3. **Analyst & Ratings Widget** — consensus rating, price target range, grade changes + horizontal bar (Buy/Hold/Sell) + price target arrow chart
4. **Key Metrics Row** — P/E, EV/EBITDA, ROE, margins, dividend yield
5. **Financial Snapshot** — last 4 quarters revenue + EPS as grouped bar chart with EPS line overlay
6. **Margin & Growth Trends** — operating margin, profit margin, revenue growth as multi-line sparklines (8 quarters)

Each section has a "View full details →" link to the corresponding tab.

### Tab 1: Financials (`/company/{ticker}/financials`)

- **Statement sub-tabs:** Income Statement / Balance Sheet / Cash Flow
- **Period toggle:** Annual vs Quarterly
- **Data table:** Full statement, 5 years annual or 20 quarters as columns
- **Charts:**
  - Revenue & Profitability — stacked area chart (revenue, gross profit, operating income, net income)
  - Revenue Breakdown — stacked bar (product segments) + donut (geographic segments)
  - Margins Over Time — multi-line chart (gross, operating, net, EBITDA margins)
  - Cash Flow Waterfall — operating CF → CapEx → FCF
  - Balance Sheet Composition — stacked bar (assets vs liabilities vs equity)
  - Per-Share Metrics — grouped bar (EPS, BVPS, FCF/share)

### Tab 2: Company Intelligence (`/company/{ticker}/intelligence`)

- **Analyst Consensus** — rating distribution + horizontal stacked bar (Strong Buy → Strong Sell)
- **Price Targets** — current vs mean/high/low + arrow/gauge chart
- **Stock Grades History** — upgrades/downgrades timeline with color-coded arrows
- **Earnings History** — last 20 quarters EPS actual vs estimate + bar chart with surprise line
- **Financial Scores** — Altman Z, Piotroski, etc. + radar/spider chart
- **Insider Trading** — recent trades table + bar chart (net buys/sells by month)
- **Senate/Congress Trades** — table with party/member/amount
- **Dividend History** — yield trend line chart + payment bar chart

### Tab 3: Valuation Modelling (`/company/{ticker}/valuation`)

Existing analysis view, reorganized:

- Consensus Card (verdict, price target, upside)
- Model Results Grid (all 11 models)
- Football Field Chart (valuation ranges)
- Sensitivity Table (DCF heat map)
- Monte Carlo Simulation (distribution histogram)
- LBO Model (returns table)
- FMP DCF Comparison (FMP's DCF vs yours, side-by-side)
- AI Investment Thesis (Claude memo)
- PDF Export

---

## 5. Feature Gating

| Feature | Free | Pro | Max |
|---|---|---|---|
| Summary page | Full | Full | Full |
| Financials (annual) | Yes | Yes | Yes |
| Financials (quarterly) | Last 4Q only | Full 5 years | Full 5 years |
| Company Intelligence | Analyst + Earnings only | Full | Full |
| Valuation Modelling | 8 models | All 12 + AI + Monte Carlo + LBO | All + priority |
| Charts | Basic (bar/line) | All chart types | All chart types |

---

## 6. Tech Decisions

- **Charts:** Recharts (already in stack)
- **Refresh scheduling:** GitHub Actions (free, reliable, manually triggerable)
- **Data storage:** Supabase (Postgres) — all FMP data cached
- **Live data:** Finnhub (price only, existing)
- **Frontend routing:** React Router (add nested routes under `/company/{ticker}`)
