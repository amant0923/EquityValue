-- EVS Tables Migration
-- Run in Supabase SQL Editor

-- EVS current scores (one row per ticker, overwritten nightly)
CREATE TABLE IF NOT EXISTS equity_value_scores (
    ticker TEXT PRIMARY KEY,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    verdict TEXT NOT NULL,
    valuation_score REAL,
    health_score REAL,
    analyst_score REAL,
    growth_score REAL,
    risk_score REAL,
    components JSONB,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EVS history (one row per ticker per day, for sparklines and backtesting)
CREATE TABLE IF NOT EXISTS equity_value_score_history (
    id SERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    score INTEGER NOT NULL,
    verdict TEXT NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ticker, (computed_at::date))
);

CREATE INDEX IF NOT EXISTS idx_evs_history_ticker ON equity_value_score_history(ticker, computed_at DESC);

-- Valuation snapshots (for accuracy tracking, Phase 2)
CREATE TABLE IF NOT EXISTS valuation_snapshots (
    id SERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    model_name TEXT NOT NULL,
    intrinsic_value REAL,
    verdict TEXT,
    price_at_snapshot REAL,
    UNIQUE(ticker, snapshot_date, model_name)
);

-- Accuracy tracking (filled by backfill job, Phase 2)
CREATE TABLE IF NOT EXISTS accuracy_tracking (
    id SERIAL PRIMARY KEY,
    ticker TEXT NOT NULL,
    snapshot_date DATE NOT NULL,
    model_name TEXT NOT NULL,
    intrinsic_value REAL,
    price_at_snapshot REAL,
    price_6mo REAL,
    price_12mo REAL,
    direction_correct_6mo BOOLEAN,
    direction_correct_12mo BOOLEAN,
    UNIQUE(ticker, snapshot_date, model_name)
);

-- User alerts (Phase 2)
CREATE TABLE IF NOT EXISTS user_alerts (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('score_threshold', 'score_change', 'verdict_flip', 'analyst_shift')),
    threshold INTEGER,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alert history (Phase 2)
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_alert_history_user ON alert_history(user_id, triggered_at DESC);

-- API usage log
CREATE TABLE IF NOT EXISTS api_usage_log (
    id SERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    user_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    response_time_ms INTEGER,
    estimated_cost REAL
);

CREATE INDEX IF NOT EXISTS idx_api_usage_timestamp ON api_usage_log(timestamp);
