-- BLU Fund Transaction Analysis Script
-- Run this in Supabase SQL Editor to check BLU fund balance

-- First, let's find the BLU fund
SELECT 'BLU Fund Information:' as section;
SELECT 
    id,
    name,
    balance as current_balance,
    status,
    created_at
FROM funds 
WHERE UPPER(name) LIKE '%BLU%' OR name ILIKE '%blu%';

-- Get all transactions for BLU fund
SELECT '\nBLU Fund Transactions:' as section;
SELECT 
    t.id,
    t.type,
    t.amount,
    t.category,
    t.date,
    t.status,
    t.note,
    t.created_at,
    f.name as fund_name
FROM transactions t
JOIN funds f ON t.source_of_funds_id = f.id
WHERE UPPER(f.name) LIKE '%BLU%' OR f.name ILIKE '%blu%'
ORDER BY t.date DESC, t.created_at DESC;

-- Calculate income vs expense summary for BLU fund
SELECT '\nBLU Fund Balance Calculation:' as section;
SELECT 
    f.name as fund_name,
    f.balance as current_balance,
    COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) as calculated_balance,
    f.balance - (COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) - 
                 COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0)) as difference
FROM funds f
LEFT JOIN transactions t ON t.source_of_funds_id = f.id
WHERE UPPER(f.name) LIKE '%BLU%' OR f.name ILIKE '%blu%'
GROUP BY f.id, f.name, f.balance;

-- Count transactions by type and status for BLU fund
SELECT '\nTransaction Count Summary:' as section;
SELECT 
    f.name as fund_name,
    t.type,
    t.status,
    COUNT(*) as transaction_count,
    SUM(t.amount) as total_amount
FROM transactions t
JOIN funds f ON t.source_of_funds_id = f.id
WHERE UPPER(f.name) LIKE '%BLU%' OR f.name ILIKE '%blu%'
GROUP BY f.name, t.type, t.status
ORDER BY f.name, t.type, t.status;

-- Check for any unpaid transactions that might affect balance
SELECT '\nUnpaid Transactions (not affecting balance):' as section;
SELECT 
    t.id,
    t.type,
    t.amount,
    t.category,
    t.date,
    t.note,
    f.name as fund_name
FROM transactions t
JOIN funds f ON t.source_of_funds_id = f.id
WHERE (UPPER(f.name) LIKE '%BLU%' OR f.name ILIKE '%blu%')
AND t.status = 'unpaid'
ORDER BY t.date DESC;