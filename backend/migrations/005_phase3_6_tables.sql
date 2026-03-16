-- Phase 3-6 additional tables and columns

-- Referral tracking
CREATE TABLE IF NOT EXISTS referrals (
    referee_id UUID PRIMARY KEY REFERENCES auth.users(id),
    referrer_id UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'signed_up' CHECK (status IN ('signed_up', 'converted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- Add referral_credits and student fields to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS referral_credits INTEGER DEFAULT 0;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS student_email TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS student_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS referred_by UUID;

-- Add volatility column to equity_value_scores
ALTER TABLE equity_value_scores ADD COLUMN IF NOT EXISTS volatility_30d REAL;

-- Thesis cache table (may already exist via thesis_cache.py)
CREATE TABLE IF NOT EXISTS thesis_cache (
    ticker TEXT PRIMARY KEY,
    thesis TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure api_usage_log has all needed columns
ALTER TABLE api_usage_log ADD COLUMN IF NOT EXISTS hashed_ip TEXT;
ALTER TABLE api_usage_log ADD COLUMN IF NOT EXISTS response_code INTEGER;
ALTER TABLE api_usage_log ADD COLUMN IF NOT EXISTS estimated_cost REAL DEFAULT 0;
