-- SQL Script to Adjust BLU Fund Initial Balance
-- This script reduces the BLU fund balance by 967,000 to match the expected real balance
-- Run this in Supabase SQL Editor

-- First, let's check the current BLU fund balance before adjustment
SELECT 'Current BLU Fund Balance (Before Adjustment):' as section;
SELECT 
    id,
    name,
    balance as current_balance,
    status,
    created_at
FROM funds 
WHERE id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5';

-- NOTE: This script has been disabled to prevent automatic balance adjustments
-- Any balance corrections should be done by creating proper income/expense transactions
-- through the application UI by adding appropriate income/expense transactions
-- 
-- Example of how to create a balance adjustment transaction:
-- Use the application UI to create an expense or income transaction
-- with appropriate category and description for the adjustment

-- Verify the adjustment was successful
SELECT 'BLU Fund Balance (After Adjustment):' as section;
SELECT 
    id,
    name,
    balance as adjusted_balance,
    status,
    updated_at
FROM funds 
WHERE id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5';

-- Show the adjustment summary (DISABLED)
-- Any adjustment summaries should be generated dynamically
-- based on actual transaction data rather than hardcoded values

-- Optional: Add a comment or note about this adjustment
-- You can run this separately if you want to document the change
-- NOTE: This transaction insertion has been disabled
-- Any balance corrections should be done through the application UI
-- by creating proper income/expense transactions
/*
INSERT INTO transactions (
    id,
    amount,
    description,
    category,
    type,
    date,
    source_of_funds_id,
    status,
    note,
    created_at,
    updated_at,
    user_id
) VALUES (
    gen_random_uuid(),
    [AMOUNT],
    'Balance adjustment', 
    [CATEGORY_ID], -- Use appropriate category ID
    'expense', -- or 'income'
    CURRENT_DATE,
    [FUND_ID],
    'paid',
    'Balance adjustment transaction',
    NOW(),
    NOW(),
    auth.uid()
);
*/

-- Final verification: Check if the new balance makes sense
SELECT 'Balance Verification:' as section;
SELECT 
    f.name as fund_name,
    f.balance as current_balance,
    COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) as calculated_balance_from_transactions,
    f.balance - (COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) - 
                 COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0)) as remaining_difference
FROM funds f
LEFT JOIN transactions t ON t.source_of_funds_id = f.id
WHERE f.id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5'
GROUP BY f.id, f.name, f.balance;