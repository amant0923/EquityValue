# FMP Data Refresh

## Schedule

| Script | Frequency | GitHub Actions Workflow | What It Refreshes |
|--------|-----------|------------------------|-------------------|
| `refresh_daily.py` | Mon-Fri | Part of nightly pipeline | analyst_data, insider_trades, senate_trades, company_scores |
| `refresh_weekly.py` | Weekly (Sunday) | `weekly-digest.yml` or manual | key_metrics, growth_metrics, dividends_history, revenue_segments |
| `refresh_quarterly.py` | Quarterly | Manual trigger | financial_statements, earnings_history |

All scripts use `fmp_client.py` for rate-limited API access (max 240 calls/min, safely under FMP's 300/min limit).

## Running Manually

### Prerequisites
```bash
cd backend
export FMP_KEY=your_fmp_api_key
export SUPABASE_URL=your_supabase_url
export SUPABASE_KEY=your_supabase_service_key
```

### Daily Refresh
```bash
python3 refresh_daily.py
```
Duration: ~5-10 minutes for all S&P 500 tickers.

### Weekly Refresh
```bash
python3 refresh_weekly.py
```
Duration: ~15-20 minutes.

### Quarterly Refresh
```bash
python3 refresh_quarterly.py
```
Duration: ~20-30 minutes (fetches full financial statements).

## Adding New Tickers

1. Add the ticker to the `stock_fundamentals` table in Supabase:
```bash
cd backend
export FMP_KEY=...
python3 fetch_missing.py
```
`fetch_missing.py` checks the current S&P 500 constituent list from FMP and upserts any missing tickers.

2. The nightly pipeline will automatically compute EVS scores for new tickers on its next run.

3. Refresh scripts will pick up new tickers automatically (they query `stock_fundamentals` for the full ticker list).

## Troubleshooting

**FMP rate limiting (HTTP 429):**
- `fmp_client.py` auto-retries with exponential backoff (60s, 120s).
- If persistent, check your FMP plan limits at financialmodelingprep.com.

**Missing data for a ticker:**
- Some tickers (especially recent additions) may not have full data in FMP.
- Check FMP directly: `curl "https://financialmodelingprep.com/stable/profile?symbol=TICKER&apikey=YOUR_KEY"`

**Supabase upsert failures:**
- Check that table schemas match the script's expected columns.
- Look for constraint violations in Supabase logs.
