-- Migration script to update subcategories table to support custom budget periods
-- This adds 'custom' to the budget_period CHECK constraint and adds budget_period_custom column

-- Step 1: Add budget_period_custom column to store custom period definitions
ALTER TABLE public.subcategories 
ADD COLUMN IF NOT EXISTS budget_period_custom TEXT;

-- Step 2: Drop the existing CHECK constraint on budget_period
ALTER TABLE public.subcategories 
DROP CONSTRAINT IF EXISTS subcategories_budget_period_check;

-- Step 3: Add new CHECK constraint that includes 'custom'
ALTER TABLE public.subcategories 
ADD CONSTRAINT subcategories_budget_period_check 
CHECK (budget_period IN ('weekly', 'monthly', 'yearly', 'custom'));

-- Step 4: Create index on budget_period_custom for better query performance
CREATE INDEX IF NOT EXISTS idx_subcategories_budget_period_custom 
ON public.subcategories(budget_period_custom) 
WHERE budget_period_custom IS NOT NULL;

-- Step 5: Add comment to document the new column
COMMENT ON COLUMN public.subcategories.budget_period_custom IS 'Stores custom period definition in format "start_day|end_day" (e.g., "3|2" for 3rd to 2nd of next month)';

-- Verification query to check the migration
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'subcategories' 
-- AND column_name IN ('budget_period', 'budget_period_custom');

COMMENT ON TABLE public.subcategories IS 'Updated to support custom budget periods with budget_period_custom column';