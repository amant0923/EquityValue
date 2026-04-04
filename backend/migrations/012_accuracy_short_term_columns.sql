-- Add short-term accuracy tracking columns (14-day and 30-day windows)
ALTER TABLE accuracy_tracking ADD COLUMN IF NOT EXISTS price_14d FLOAT;
ALTER TABLE accuracy_tracking ADD COLUMN IF NOT EXISTS direction_correct_14d BOOLEAN;
ALTER TABLE accuracy_tracking ADD COLUMN IF NOT EXISTS price_30d FLOAT;
ALTER TABLE accuracy_tracking ADD COLUMN IF NOT EXISTS direction_correct_30d BOOLEAN;
