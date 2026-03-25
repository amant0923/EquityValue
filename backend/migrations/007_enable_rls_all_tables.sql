-- ============================================================================
-- Migration 007: Enable Row Level Security on ALL tables
-- ============================================================================
-- CRITICAL FIX: Supabase exposes all public-schema tables via PostgREST.
-- The anon key is in the frontend JS bundle (public). Without RLS, anyone
-- can read/write ANY table directly. This migration locks everything down.
--
-- Strategy:
--   1. Public data tables → RLS ON + SELECT for anon/authenticated, no write
--   2. User data tables   → RLS ON + CRUD scoped to auth.uid()
--   3. Admin/log tables   → RLS ON + no public access (service_role only)
--   4. All writes to public data go through service_role (nightly pipelines)
--
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Paste → Run)
-- ============================================================================

-- ─── SECTION 1: PUBLIC DATA TABLES (read-only for everyone) ─────────────────
-- These contain stock fundamentals, financials, scores — public information.
-- Anyone can SELECT, but only service_role can INSERT/UPDATE/DELETE.

-- stock_fundamentals
ALTER TABLE stock_fundamentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON stock_fundamentals
  FOR SELECT USING (true);

-- financial_statements
ALTER TABLE financial_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON financial_statements
  FOR SELECT USING (true);

-- key_metrics
ALTER TABLE key_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON key_metrics
  FOR SELECT USING (true);

-- growth_metrics
ALTER TABLE growth_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON growth_metrics
  FOR SELECT USING (true);

-- analyst_data
ALTER TABLE analyst_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON analyst_data
  FOR SELECT USING (true);

-- insider_trades
ALTER TABLE insider_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON insider_trades
  FOR SELECT USING (true);

-- earnings_history
ALTER TABLE earnings_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON earnings_history
  FOR SELECT USING (true);

-- dividends_history
ALTER TABLE dividends_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON dividends_history
  FOR SELECT USING (true);

-- revenue_segments
ALTER TABLE revenue_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON revenue_segments
  FOR SELECT USING (true);

-- company_scores
ALTER TABLE company_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON company_scores
  FOR SELECT USING (true);

-- senate_trades
ALTER TABLE senate_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON senate_trades
  FOR SELECT USING (true);

-- equity_value_scores
ALTER TABLE equity_value_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON equity_value_scores
  FOR SELECT USING (true);

-- equity_value_score_history
ALTER TABLE equity_value_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON equity_value_score_history
  FOR SELECT USING (true);

-- valuation_snapshots
ALTER TABLE valuation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON valuation_snapshots
  FOR SELECT USING (true);

-- accuracy_tracking
ALTER TABLE accuracy_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON accuracy_tracking
  FOR SELECT USING (true);

-- cached_theses (AI-generated theses — public read is fine, only service writes)
-- Note: migration 005 called this "thesis_cache" but code uses "cached_theses"
ALTER TABLE IF EXISTS cached_theses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'cached_theses') THEN
    CREATE POLICY "Public read access" ON cached_theses FOR SELECT USING (true);
  END IF;
END $$;


-- ─── SECTION 2: USER DATA TABLES (scoped to authenticated user) ────────────
-- These contain per-user data. Only the owning user can read/write.
-- Service_role bypasses RLS for backend operations.

-- user_alerts
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own alerts" ON user_alerts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- alert_history
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own alert history" ON alert_history
  FOR SELECT USING (auth.uid() = user_id);
-- Service_role inserts alert history (nightly pipeline), users only read


-- ─── SECTION 3: REFERRAL TABLE (user-scoped) ───────────────────────────────

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
-- Referrers can see their referrals
CREATE POLICY "Referrers see own referrals" ON referrals
  FOR SELECT USING (auth.uid() = referrer_id);
-- Referees can see their own referral record
CREATE POLICY "Referees see own record" ON referrals
  FOR SELECT USING (auth.uid() = referee_id);
-- Only service_role can INSERT/UPDATE (backend handles referral creation)


-- ─── SECTION 4: ADMIN/LOG TABLES (service_role only) ───────────────────────
-- No public read or write. Only the backend service key can access.

ALTER TABLE api_usage_log ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated. Service_role bypasses RLS.


-- ============================================================================
-- VERIFICATION QUERY (run after migration to confirm all tables have RLS):
-- ============================================================================
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- All rows should show rowsecurity = true
-- ============================================================================
