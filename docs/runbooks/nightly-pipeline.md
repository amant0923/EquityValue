# Nightly EVS Pipeline

## What It Does

Runs Mon-Fri at 6:00 AM ET via GitHub Actions (`nightly-evs-pipeline.yml`).

Steps (in order):
1. **Compute EVS scores** for all ~500 S&P 500 tickers. Reads fundamentals, metrics, analyst data from Supabase, computes the 1-100 composite score, and upserts to `equity_value_scores`.
2. **Snapshot valuations** — runs all 11 valuation models per ticker, writes to `valuation_snapshots`.
3. **Append score history** — writes today's score to `equity_value_score_history` for trend tracking.
4. **Backfill accuracy** — checks 6-month and 12-month-old snapshots against actual prices, updates `accuracy_tracking`.
5. **Fire alerts** — checks `user_alerts` subscriptions and creates `alert_history` entries for triggered alerts.

## Expected Duration

- Full pipeline: 15-25 minutes (rate-limited by Supabase queries).
- GitHub Actions timeout is set to 45 minutes.

## How to Run Manually

### Via GitHub Actions UI
1. Go to **Actions** tab in the GitHub repo.
2. Select **Nightly EVS Pipeline** workflow.
3. Click **Run workflow** > select `main` branch > **Run**.

### Locally
```bash
cd backend
export SUPABASE_URL=...
export SUPABASE_KEY=...
export FMP_KEY=...
export FINNHUB_KEY=...

# Run the full pipeline
python3 -c "from evs.snapshot import run_nightly_pipeline; run_nightly_pipeline()"
```

## Debugging Failures

### Common Issues

**"Database not configured" errors:**
- Check that `SUPABASE_URL` and `SUPABASE_KEY` secrets are set in GitHub repo settings.

**Timeout (>45 min):**
- Usually caused by Supabase rate limiting. Check if there's a spike in API usage.
- Reduce batch size in `evs/snapshot.py` if persistent.

**Partial completion:**
- The pipeline processes tickers in batches. Check `equity_value_scores.computed_at` — if some are stale while others are fresh, a batch failed mid-run.
- Re-run the workflow; it will re-compute all scores (idempotent upsert).

**Score calculation errors:**
- Check Sentry for exceptions from `evs/score.py`.
- Missing data for a ticker will result in a lower score (nulls are handled gracefully), not a crash.

### Checking Results
```sql
-- How many tickers were scored today?
SELECT COUNT(*), MAX(computed_at) FROM equity_value_scores;

-- Any stale scores (>48 hours)?
SELECT ticker, computed_at FROM equity_value_scores
WHERE computed_at < NOW() - INTERVAL '48 hours';

-- Recent accuracy backfill
SELECT COUNT(*) FROM accuracy_tracking WHERE snapshot_date > NOW() - INTERVAL '7 days';
```
