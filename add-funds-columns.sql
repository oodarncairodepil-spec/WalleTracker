-- Add missing columns to funds table
ALTER TABLE funds ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE funds ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

-- Update existing funds to have Active status if null
UPDATE funds SET status = 'Active' WHERE status IS NULL;