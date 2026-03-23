-- Migration: Add student verification token and referral code columns
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- These columns support the new student email verification flow and
-- cryptographically random referral codes.

-- 1. Student verification token (for email verification flow)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS student_verify_token TEXT DEFAULT NULL;

-- 2. Cryptographically random referral code (replaces UUID prefix)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS referral_code TEXT DEFAULT NULL;

-- Add unique index on referral_code for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_referral_code
ON user_profiles (referral_code)
WHERE referral_code IS NOT NULL;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN ('student_verify_token', 'referral_code');
