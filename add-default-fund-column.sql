-- Add is_default column to funds table
ALTER TABLE funds ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create a unique constraint to ensure only one default fund per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_funds_user_default 
ON funds (user_id) 
WHERE is_default = true;

-- Create a function to ensure only one default fund per user
CREATE OR REPLACE FUNCTION ensure_single_default_fund()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting a fund as default, unset all other defaults for this user
  IF NEW.is_default = true THEN
    UPDATE funds 
    SET is_default = false 
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce single default fund
DROP TRIGGER IF EXISTS trigger_ensure_single_default_fund ON funds;
CREATE TRIGGER trigger_ensure_single_default_fund
  BEFORE INSERT OR UPDATE ON funds
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_fund();