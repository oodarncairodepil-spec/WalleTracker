-- Migration script to change amount and balance fields from DECIMAL to BIGINT
-- This removes decimal support for IDR currency (Indonesian Rupiah)

-- Update funds table: change balance from DECIMAL(10,2) to BIGINT
ALTER TABLE funds ALTER COLUMN balance TYPE BIGINT USING balance::BIGINT;
ALTER TABLE funds ALTER COLUMN balance SET DEFAULT 0;

-- Update transactions table: change amount from DECIMAL(10,2) to BIGINT  
ALTER TABLE transactions ALTER COLUMN amount TYPE BIGINT USING amount::BIGINT;

-- Note: This converts existing decimal values to integers by truncating decimals
-- For example: 1000.50 becomes 1000 (decimal part is removed)
-- After this migration, all amounts should be entered as whole numbers (no decimals)