-- Migration: Add destination_fund_id column to transactions table
-- This column is needed to properly store the destination fund for internal transfers

-- Add the destination_fund_id column to the transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS destination_fund_id UUID REFERENCES funds(id) ON DELETE SET NULL;

-- Create an index for better performance when querying by destination fund
CREATE INDEX IF NOT EXISTS idx_transactions_destination_fund_id 
ON transactions(destination_fund_id);

-- Add a comment to document the purpose of this column
COMMENT ON COLUMN transactions.destination_fund_id IS 'References the destination fund for internal transfer transactions';

-- Verification query to check if the column was added successfully
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'transactions' AND column_name = 'destination_fund_id';