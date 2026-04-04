-- Add student_verify_token_created_at for token expiry checks
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS student_verify_token_created_at TIMESTAMPTZ DEFAULT NULL;
