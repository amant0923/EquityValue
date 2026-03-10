-- Key metrics (quarterly + annual)
CREATE TABLE IF NOT EXISTS key_metrics (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  period_date DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('Q1','Q2','Q3','Q4','FY')),
  revenue_per_share NUMERIC,
  net_income_per_share NUMERIC,
  operating_cash_flow_per_share NUMERIC,
  free_cash_flow_per_share NUMERIC,
  cash_per_share NUMERIC,
  book_value_per_share NUMERIC,
  tangible_book_value_per_share NUMERIC,
  shareholders_equity_per_share NUMERIC,
  interest_debt_per_share NUMERIC,
  market_cap NUMERIC,
  enterprise_value NUMERIC,
  pe_ratio NUMERIC,
  price_to_sales NUMERIC,
  pocf_ratio NUMERIC,
  pfcf_ratio NUMERIC,
  pb_ratio NUMERIC,
  ptb_ratio NUMERIC,
  ev_to_sales NUMERIC,
  enterprise_value_over_ebitda NUMERIC,
  ev_to_operating_cash_flow NUMERIC,
  ev_to_free_cash_flow NUMERIC,
  earnings_yield NUMERIC,
  free_cash_flow_yield NUMERIC,
  debt_to_equity NUMERIC,
  debt_to_assets NUMERIC,
  net_debt_to_ebitda NUMERIC,
  current_ratio NUMERIC,
  interest_coverage NUMERIC,
  income_quality NUMERIC,
  dividend_yield NUMERIC,
  payout_ratio NUMERIC,
  sga_to_revenue NUMERIC,
  rnd_to_revenue NUMERIC,
  intangibles_to_total_assets NUMERIC,
  capex_to_operating_cash_flow NUMERIC,
  capex_to_revenue NUMERIC,
  capex_to_depreciation NUMERIC,
  stock_based_compensation_to_revenue NUMERIC,
  graham_number NUMERIC,
  roic NUMERIC,
  return_on_tangible_assets NUMERIC,
  graham_net_net NUMERIC,
  working_capital NUMERIC,
  tangible_asset_value NUMERIC,
  net_current_asset_value NUMERIC,
  invested_capital NUMERIC,
  average_receivables NUMERIC,
  average_payables NUMERIC,
  average_inventory NUMERIC,
  days_sales_outstanding NUMERIC,
  days_payables_outstanding NUMERIC,
  days_of_inventory_on_hand NUMERIC,
  receivables_turnover NUMERIC,
  payables_turnover NUMERIC,
  inventory_turnover NUMERIC,
  roe NUMERIC,
  roa NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, period_date, period_type)
);

-- Growth metrics
CREATE TABLE IF NOT EXISTS growth_metrics (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  period_date DATE NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('Q1','Q2','Q3','Q4','FY')),
  revenue_growth NUMERIC,
  gross_profit_growth NUMERIC,
  ebitda_growth NUMERIC,
  operating_income_growth NUMERIC,
  net_income_growth NUMERIC,
  eps_growth NUMERIC,
  eps_diluted_growth NUMERIC,
  weighted_avg_shares_growth NUMERIC,
  operating_cash_flow_growth NUMERIC,
  free_cash_flow_growth NUMERIC,
  receivables_growth NUMERIC,
  inventory_growth NUMERIC,
  asset_growth NUMERIC,
  book_value_per_share_growth NUMERIC,
  debt_growth NUMERIC,
  rd_expense_growth NUMERIC,
  sga_expense_growth NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, period_date, period_type)
);

-- Analyst data
CREATE TABLE IF NOT EXISTS analyst_data (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  updated_date DATE NOT NULL,
  -- Ratings
  strong_buy INT,
  buy INT,
  hold INT,
  sell INT,
  strong_sell INT,
  consensus TEXT,
  -- Price targets
  target_high NUMERIC,
  target_low NUMERIC,
  target_mean NUMERIC,
  target_median NUMERIC,
  target_count INT,
  -- Latest grades (stored as JSONB array)
  recent_grades JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker)
);

-- Insider trades
CREATE TABLE IF NOT EXISTS insider_trades (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  filing_date DATE,
  transaction_date DATE,
  reporter_name TEXT,
  reporter_title TEXT,
  transaction_type TEXT,
  shares_traded NUMERIC,
  price NUMERIC,
  total_value NUMERIC,
  shares_owned_after NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, filing_date, reporter_name, transaction_type, shares_traded)
);

-- Earnings history
CREATE TABLE IF NOT EXISTS earnings_history (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  date DATE NOT NULL,
  fiscal_period TEXT,
  eps_actual NUMERIC,
  eps_estimate NUMERIC,
  eps_surprise NUMERIC,
  eps_surprise_pct NUMERIC,
  revenue_actual NUMERIC,
  revenue_estimate NUMERIC,
  revenue_surprise NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date)
);

-- Dividends history
CREATE TABLE IF NOT EXISTS dividends_history (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  ex_date DATE,
  pay_date DATE,
  record_date DATE,
  declaration_date DATE,
  amount NUMERIC,
  yield NUMERIC,
  frequency TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, ex_date)
);

-- Revenue segments
CREATE TABLE IF NOT EXISTS revenue_segments (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  period_date DATE NOT NULL,
  segment_type TEXT NOT NULL CHECK (segment_type IN ('product','geographic')),
  segment_name TEXT NOT NULL,
  revenue NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, period_date, segment_type, segment_name)
);

-- Company scores
CREATE TABLE IF NOT EXISTS company_scores (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  updated_date DATE NOT NULL,
  altman_z_score NUMERIC,
  piotroski_score NUMERIC,
  financial_score JSONB,
  dcf_value NUMERIC,
  levered_dcf NUMERIC,
  owner_earnings NUMERIC,
  owner_earnings_per_share NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker)
);

-- Senate trades
CREATE TABLE IF NOT EXISTS senate_trades (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  transaction_date DATE,
  disclosure_date DATE,
  senator_name TEXT,
  party TEXT,
  state TEXT,
  transaction_type TEXT,
  amount_range TEXT,
  asset_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, transaction_date, senator_name, transaction_type)
);

-- Indexes
CREATE INDEX idx_km_ticker ON key_metrics(ticker);
CREATE INDEX idx_gm_ticker ON growth_metrics(ticker);
CREATE INDEX idx_ad_ticker ON analyst_data(ticker);
CREATE INDEX idx_it_ticker ON insider_trades(ticker);
CREATE INDEX idx_eh_ticker ON earnings_history(ticker);
CREATE INDEX idx_dh_ticker ON dividends_history(ticker);
CREATE INDEX idx_rs_ticker ON revenue_segments(ticker);
CREATE INDEX idx_cs_ticker ON company_scores(ticker);
CREATE INDEX idx_st_ticker ON senate_trades(ticker);
