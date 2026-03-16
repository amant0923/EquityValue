-- Migration: Switch from Free/Pro/Max to Trial/Pro pricing model
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Drop the old CHECK constraint FIRST (so new values are allowed)
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_plan_check;

-- 2. Add new columns for trial tracking
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS analyses_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_started TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS student_email TEXT,
  ADD COLUMN IF NOT EXISTS student_verified BOOLEAN DEFAULT FALSE;

-- 3. Migrate existing users: free -> trial, max -> pro
UPDATE user_profiles SET plan = 'trial' WHERE plan = 'free';
UPDATE user_profiles SET plan = 'pro' WHERE plan = 'max';

-- 4. Add the new CHECK constraint with updated values
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_plan_check
  CHECK (plan IN ('trial', 'expired', 'pro', 'lifetime'));

-- 4. Update the trigger function for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, plan, analyses_today, analyses_total, trial_started, last_analysis_date)
  VALUES (NEW.id, 'trial', 0, 0, NOW(), CURRENT_DATE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Recreate the trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
