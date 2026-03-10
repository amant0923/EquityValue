-- Portfolio tracking tables
-- Run in Supabase SQL Editor

-- 1. User portfolios
CREATE TABLE IF NOT EXISTS user_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_up_user ON user_portfolios(user_id);

-- 2. Portfolio holdings
CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES user_portfolios(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  shares NUMERIC NOT NULL CHECK (shares > 0),
  avg_price NUMERIC NOT NULL CHECK (avg_price > 0),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_ph_portfolio ON portfolio_holdings(portfolio_id);

-- 3. Portfolio snapshots
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES user_portfolios(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_value NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  UNIQUE(portfolio_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_ps_portfolio_date ON portfolio_snapshots(portfolio_id, snapshot_date);

-- 4. RLS policies
ALTER TABLE user_portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_portfolios" ON user_portfolios
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_holdings" ON portfolio_holdings
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM user_portfolios WHERE user_id = auth.uid())
  );

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_snapshots" ON portfolio_snapshots
  FOR ALL USING (
    portfolio_id IN (SELECT id FROM user_portfolios WHERE user_id = auth.uid())
  );

-- 5. Auto-update updated_at on holdings
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_holdings_updated_at
  BEFORE UPDATE ON portfolio_holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
