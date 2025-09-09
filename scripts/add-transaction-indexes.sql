-- Add database indexes for optimal transaction query performance
-- These indexes will improve performance for common query patterns

-- Index for date range queries (most common filter)
CREATE INDEX IF NOT EXISTS idx_transactions_date 
ON transactions(date);

-- Index for user-specific queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_id 
ON transactions(user_id);

-- Index for status filtering (paid/unpaid)
CREATE INDEX IF NOT EXISTS idx_transactions_status 
ON transactions(status);

-- Index for transaction type filtering (income/expense)
CREATE INDEX IF NOT EXISTS idx_transactions_type 
ON transactions(type);

-- Index for source fund filtering
CREATE INDEX IF NOT EXISTS idx_transactions_source_of_funds_id 
ON transactions(source_of_funds_id);

-- Composite index for date range queries with user filtering
CREATE INDEX IF NOT EXISTS idx_transactions_user_date 
ON transactions(user_id, date);

-- Composite index for unpaid expenses queries
CREATE INDEX IF NOT EXISTS idx_transactions_status_type_date 
ON transactions(status, type, date);

-- Composite index for user-specific date range and status queries
CREATE INDEX IF NOT EXISTS idx_transactions_user_status_date 
ON transactions(user_id, status, date);

-- Verification query to check indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'transactions'
ORDER BY indexname;