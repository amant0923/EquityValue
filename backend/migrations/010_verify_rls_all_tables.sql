-- ============================================================================
-- Migration 010: Catch-All RLS Verification (2026-04-01)
-- ============================================================================
-- SAFETY NET: Migrations 007 and 009 already enable RLS and create policies
-- for most tables. This migration is a defensive catch-all that:
--   1. Re-enables RLS on every known public-schema table (idempotent)
--   2. Creates SELECT policies only if they do not already exist
--   3. Creates user-scoped policies only if they do not already exist
--   4. Ensures admin tables have RLS with no public policies
--
-- Running this migration is always safe — it never drops or replaces policies.
-- If a policy already exists, the DO $$ block simply skips it.
--
-- Table categories:
--   PUBLIC DATA (25 tables) — anon/authenticated can SELECT, no write
--   USER-SCOPED (7 tables) — auth.uid() scoped CRUD
--   ADMIN/LOG   (1 table)  — no public policies, service_role only
--
-- Run in Supabase SQL Editor (Dashboard > SQL Editor > New Query > Paste > Run)
-- ============================================================================


-- ─── SECTION 1: PUBLIC DATA TABLES (read-only for anon/authenticated) ────────
-- Anyone can SELECT. Only service_role (backend pipelines) can write.
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent — safe to repeat.

DO $$
DECLARE
  t TEXT;
  public_tables TEXT[] := ARRAY[
    'stock_fundamentals',
    'financial_statements',
    'key_metrics',
    'growth_metrics',
    'analyst_data',
    'insider_trades',
    'earnings_history',
    'dividends_history',
    'revenue_segments',
    'company_scores',
    'senate_trades',
    'equity_value_scores',
    'equity_value_score_history',
    'valuation_snapshots',
    'accuracy_tracking',
    'cached_theses',
    'technicals_cache',
    'risk_analysis_cache',
    'price_forecasts',
    'macro_cache',
    'macro_sector_cache',
    'governance_cache',
    'wacc_cache',
    'estimates_cache',
    'qualitative_cache'
  ];
BEGIN
  FOREACH t IN ARRAY public_tables LOOP
    -- Skip tables that do not exist yet
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = t
    ) THEN
      -- Enable RLS (idempotent)
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

      -- Create "Public read access" policy if missing
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t AND policyname = 'Public read access'
      ) THEN
        EXECUTE format(
          'CREATE POLICY "Public read access" ON %I FOR SELECT USING (true)',
          t
        );
        RAISE NOTICE 'Created "Public read access" policy on %', t;
      ELSE
        RAISE NOTICE 'Policy "Public read access" already exists on %', t;
      END IF;
    ELSE
      RAISE NOTICE 'Table % does not exist — skipping', t;
    END IF;
  END LOOP;
END $$;


-- ─── SECTION 2: USER-SCOPED TABLES ──────────────────────────────────────────
-- Authenticated users can only access their own rows via auth.uid().

-- 2a. user_profiles
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_profiles')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Users manage own profile')
  THEN
    CREATE POLICY "Users manage own profile" ON user_profiles
      FOR ALL USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
    RAISE NOTICE 'Created user-scoped policy on user_profiles';
  END IF;
END $$;

-- 2b. user_portfolios
ALTER TABLE IF EXISTS user_portfolios ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_portfolios')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_portfolios' AND policyname = 'Users manage own portfolios')
  THEN
    CREATE POLICY "Users manage own portfolios" ON user_portfolios
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    RAISE NOTICE 'Created user-scoped policy on user_portfolios';
  END IF;
END $$;

-- 2c. portfolio_holdings (scoped via parent portfolio ownership)
ALTER TABLE IF EXISTS portfolio_holdings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'portfolio_holdings')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'portfolio_holdings' AND policyname = 'Users manage own holdings')
  THEN
    CREATE POLICY "Users manage own holdings" ON portfolio_holdings
      FOR ALL USING (
        portfolio_id IN (SELECT id FROM user_portfolios WHERE user_id = auth.uid())
      )
      WITH CHECK (
        portfolio_id IN (SELECT id FROM user_portfolios WHERE user_id = auth.uid())
      );
    RAISE NOTICE 'Created user-scoped policy on portfolio_holdings';
  END IF;
END $$;

-- 2d. portfolio_snapshots (read-only for users, scoped via parent portfolio)
ALTER TABLE IF EXISTS portfolio_snapshots ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'portfolio_snapshots')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'portfolio_snapshots' AND policyname = 'Users read own snapshots')
  THEN
    CREATE POLICY "Users read own snapshots" ON portfolio_snapshots
      FOR SELECT USING (
        portfolio_id IN (SELECT id FROM user_portfolios WHERE user_id = auth.uid())
      );
    RAISE NOTICE 'Created user-scoped policy on portfolio_snapshots';
  END IF;
END $$;

-- 2e. user_alerts
ALTER TABLE IF EXISTS user_alerts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_alerts')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_alerts' AND policyname = 'Users manage own alerts')
  THEN
    CREATE POLICY "Users manage own alerts" ON user_alerts
      FOR ALL USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
    RAISE NOTICE 'Created user-scoped policy on user_alerts';
  END IF;
END $$;

-- 2f. alert_history (read-only for users, service_role writes)
ALTER TABLE IF EXISTS alert_history ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'alert_history')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'alert_history' AND policyname = 'Users read own alert history')
  THEN
    CREATE POLICY "Users read own alert history" ON alert_history
      FOR SELECT USING (auth.uid() = user_id);
    RAISE NOTICE 'Created user-scoped policy on alert_history';
  END IF;
END $$;

-- 2g. referrals (users can see referrals they sent or received)
ALTER TABLE IF EXISTS referrals ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'referrals')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referrals' AND policyname = 'Referrers see own referrals')
  THEN
    CREATE POLICY "Referrers see own referrals" ON referrals
      FOR SELECT USING (auth.uid() = referrer_id);
    RAISE NOTICE 'Created referrer policy on referrals';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'referrals')
     AND NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'referrals' AND policyname = 'Referees see own record')
  THEN
    CREATE POLICY "Referees see own record" ON referrals
      FOR SELECT USING (auth.uid() = referee_id);
    RAISE NOTICE 'Created referee policy on referrals';
  END IF;
END $$;


-- ─── SECTION 3: ADMIN/LOG TABLES (service_role only) ────────────────────────
-- RLS enabled with NO public policies = only service_role can access.

ALTER TABLE IF EXISTS api_usage_log ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies. service_role bypasses RLS.


-- ─── SECTION 4: VERIFICATION ────────────────────────────────────────────────
-- Run this query after the migration to confirm all tables have RLS enabled:
--
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public'
--   ORDER BY tablename;
--
-- Expected: every row shows rowsecurity = true.
--
-- To see all policies:
--
--   SELECT tablename, policyname, cmd, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--   ORDER BY tablename, policyname;
-- ============================================================================
