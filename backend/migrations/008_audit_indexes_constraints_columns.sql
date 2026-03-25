-- ============================================================================
-- Migration 008: Database Audit — Indexes, Constraints, and Missing Columns
-- ============================================================================
-- Findings from comprehensive database audit (2026-03-25).
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS guards).
-- Safe to run on a live database — no locks on existing data.
-- ============================================================================


-- ─── SECTION 1: MISSING COLUMNS ─────────────────────────────────────────────

-- 1a. equity_value_scores: sector ranking columns (written by compute_sector_rankings)
ALTER TABLE equity_value_scores ADD COLUMN IF NOT EXISTS sector_rank INTEGER;
ALTER TABLE equity_value_scores ADD COLUMN IF NOT EXISTS sector_percentile REAL;
ALTER TABLE equity_value_scores ADD COLUMN IF NOT EXISTS sector_total INTEGER;

-- 1b. accuracy_tracking: sector column (written by backfill_accuracy)
ALTER TABLE accuracy_tracking ADD COLUMN IF NOT EXISTS sector TEXT;

-- 1c. Rename thesis_cache → cached_theses if migration 005 created the wrong name
-- The code uses "cached_theses" but migration 005 created "thesis_cache".
-- If thesis_cache exists and cached_theses does not, rename it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'thesis_cache')
     AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cached_theses')
  THEN
    ALTER TABLE thesis_cache RENAME TO cached_theses;
  END IF;
END $$;

-- If cached_theses still doesn't exist (fresh install), create it
CREATE TABLE IF NOT EXISTS cached_theses (
    ticker TEXT PRIMARY KEY,
    thesis TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─── SECTION 2: MISSING INDEXES ─────────────────────────────────────────────

-- 2a. equity_value_scores.score — used by /evs/top and /evs/bottom ORDER BY
CREATE INDEX IF NOT EXISTS idx_evs_score ON equity_value_scores(score DESC);

-- 2b. accuracy_tracking.model_name — used by /accuracy/models aggregation
CREATE INDEX IF NOT EXISTS idx_accuracy_model ON accuracy_tracking(model_name);

-- 2c. accuracy_tracking.sector — used by sector-based accuracy queries
CREATE INDEX IF NOT EXISTS idx_accuracy_sector ON accuracy_tracking(sector);

-- 2d. user_alerts(user_id, enabled) — used by alert subscription lookups
CREATE INDEX IF NOT EXISTS idx_user_alerts_user_enabled ON user_alerts(user_id, enabled);

-- 2e. alert_history(user_id, read) — used for unread count badge
CREATE INDEX IF NOT EXISTS idx_alert_history_unread ON alert_history(user_id, read)
  WHERE read = false;

-- 2f. api_usage_log(user_id, timestamp) — used for per-user usage queries
CREATE INDEX IF NOT EXISTS idx_api_usage_user ON api_usage_log(user_id, timestamp DESC);

-- 2g. api_usage_log(endpoint) — used for endpoint-level analytics
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage_log(endpoint, timestamp DESC);

-- 2h. valuation_snapshots(snapshot_date) — used by backfill_accuracy date lookups
CREATE INDEX IF NOT EXISTS idx_val_snap_date ON valuation_snapshots(snapshot_date);

-- 2i. valuation_snapshots(ticker) — used by per-ticker accuracy history
CREATE INDEX IF NOT EXISTS idx_val_snap_ticker ON valuation_snapshots(ticker, snapshot_date DESC);

-- 2j. financial_statements composite — used by financials endpoint filtering
CREATE INDEX IF NOT EXISTS idx_fin_stmt_ticker_type ON financial_statements(ticker, statement_type, period_date DESC);

-- 2k. key_metrics composite — used by metrics endpoint filtering
CREATE INDEX IF NOT EXISTS idx_key_metrics_ticker_type ON key_metrics(ticker, period_type, period_date DESC);

-- 2l. growth_metrics(ticker) — used by growth endpoint
CREATE INDEX IF NOT EXISTS idx_growth_metrics_ticker ON growth_metrics(ticker, period_date DESC);

-- 2m. insider_trades(ticker, filing_date) — used by intelligence endpoint
CREATE INDEX IF NOT EXISTS idx_insider_ticker_date ON insider_trades(ticker, filing_date DESC);

-- 2n. senate_trades(ticker) — used by intelligence endpoint
CREATE INDEX IF NOT EXISTS idx_senate_ticker ON senate_trades(ticker);

-- 2o. earnings_history(ticker, date) — used by intelligence endpoint
CREATE INDEX IF NOT EXISTS idx_earnings_ticker_date ON earnings_history(ticker, date DESC);

-- 2p. dividends_history(ticker) — used by intelligence endpoint
CREATE INDEX IF NOT EXISTS idx_dividends_ticker ON dividends_history(ticker, ex_date DESC);

-- 2q. revenue_segments(ticker) — used by segments endpoint
CREATE INDEX IF NOT EXISTS idx_segments_ticker ON revenue_segments(ticker, period_date DESC);

-- 2r. company_scores(ticker) — primary lookup path
CREATE INDEX IF NOT EXISTS idx_company_scores_ticker ON company_scores(ticker);

-- 2s. equity_value_score_history: add ticker-only index for sparkline queries
CREATE INDEX IF NOT EXISTS idx_evs_history_ticker_only ON equity_value_score_history(ticker);


-- ─── SECTION 3: CHECK CONSTRAINTS ──────────────────────────────────────────

-- 3a. EVS history score range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_evs_history_score_range'
  ) THEN
    ALTER TABLE equity_value_score_history
      ADD CONSTRAINT chk_evs_history_score_range CHECK (score >= 0 AND score <= 100);
  END IF;
END $$;

-- 3b. Valuation snapshots: intrinsic_value should be positive when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_val_snap_iv_positive'
  ) THEN
    ALTER TABLE valuation_snapshots
      ADD CONSTRAINT chk_val_snap_iv_positive CHECK (intrinsic_value IS NULL OR intrinsic_value > 0);
  END IF;
END $$;

-- 3c. Valuation snapshots: price_at_snapshot should be positive when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_val_snap_price_positive'
  ) THEN
    ALTER TABLE valuation_snapshots
      ADD CONSTRAINT chk_val_snap_price_positive CHECK (price_at_snapshot IS NULL OR price_at_snapshot > 0);
  END IF;
END $$;

-- 3d. api_usage_log: response_time_ms should be non-negative
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_api_usage_response_time'
  ) THEN
    ALTER TABLE api_usage_log
      ADD CONSTRAINT chk_api_usage_response_time CHECK (response_time_ms IS NULL OR response_time_ms >= 0);
  END IF;
END $$;


-- ─── SECTION 4: RLS FOR NEW/RENAMED TABLES ─────────────────────────────────

-- cached_theses (may have been renamed from thesis_cache, needs RLS)
ALTER TABLE cached_theses ENABLE ROW LEVEL SECURITY;
-- Idempotent policy creation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cached_theses' AND policyname = 'Public read access'
  ) THEN
    CREATE POLICY "Public read access" ON cached_theses FOR SELECT USING (true);
  END IF;
END $$;


-- ─── SECTION 5: DATA RETENTION HELPER ───────────────────────────────────────
-- These are optional maintenance queries, not auto-executed.
-- Run manually or via a scheduled job to prevent unbounded table growth.

-- Retention policy comments (for documentation, not auto-executed):
COMMENT ON TABLE equity_value_score_history IS 'Retention: keep 365 days. DELETE WHERE computed_at < NOW() - INTERVAL ''365 days''';
COMMENT ON TABLE api_usage_log IS 'Retention: keep 90 days. DELETE WHERE timestamp < NOW() - INTERVAL ''90 days''';
COMMENT ON TABLE valuation_snapshots IS 'Retention: keep 730 days. DELETE WHERE snapshot_date < NOW() - INTERVAL ''730 days''';
COMMENT ON TABLE accuracy_tracking IS 'Retention: keep 730 days. DELETE WHERE snapshot_date < NOW() - INTERVAL ''730 days''';


-- ============================================================================
-- VERIFICATION QUERIES:
-- ============================================================================
-- Check all indexes:
--   SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
--
-- Check all constraints:
--   SELECT conname, conrelid::regclass, pg_get_constraintdef(oid)
--   FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conrelid::regclass;
--
-- Check columns on equity_value_scores:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'equity_value_scores' ORDER BY ordinal_position;
-- ============================================================================
