-- Add payment_failed flag for failed payment banner
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS payment_failed BOOLEAN NOT NULL DEFAULT FALSE;
