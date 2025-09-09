-- Quick check for BLU fund initial balance
-- This could explain the 997,299 discrepancy

-- 1. Check fund creation details and any initial balance
SELECT 'BLU Fund Creation Details:' as section;
SELECT 
    id,
    name,
    current_balance,
    status,
    created_at,
    -- Check if current balance was set at creation
    CASE 
        WHEN current_balance > 0 THEN 'Fund created with initial balance'
        ELSE 'Fund created with zero balance'
    END as initial_balance_status
FROM funds 
WHERE id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5';

-- 2. Check for the earliest transaction to see if it matches fund creation
SELECT '\nEarliest BLU Transaction:' as section;
SELECT 
    t.id,
    t.type,
    t.amount,
    t.date,
    t.created_at,
    t.note,
    f.created_at as fund_created_at,
    CASE 
        WHEN t.created_at::date = f.created_at::date THEN 'Same day as fund creation'
        ELSE 'Different day from fund creation'
    END as timing_comparison
FROM transactions t
JOIN funds f ON t.source_of_funds_id = f.id
WHERE f.id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5'
ORDER BY t.date ASC, t.created_at ASC
LIMIT 1;

-- 3. Check if there are any balance adjustment or initialization transactions
SELECT '\nPossible Balance Adjustment Transactions:' as section;
SELECT 
    t.id,
    t.type,
    t.amount,
    t.category,
    t.date,
    t.note,
    t.created_at,
    c.name as category_name
FROM transactions t
JOIN funds f ON t.source_of_funds_id = f.id
LEFT JOIN categories c ON t.category = c.id
WHERE f.id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5'
AND (t.note ILIKE '%initial%' 
     OR t.note ILIKE '%balance%' 
     OR t.note ILIKE '%adjustment%'
     OR t.note ILIKE '%opening%'
     OR c.name ILIKE '%initial%'
     OR c.name ILIKE '%balance%'
     OR c.name ILIKE '%adjustment%'
     OR c.name ILIKE '%opening%')
ORDER BY t.date ASC;

-- 4. Dynamic balance calculation check
SELECT '\nBalance Mystery Solver:' as section;
WITH fund_calculations AS (
    SELECT 
        f.current_balance as actual_balance,
        COALESCE(SUM(CASE WHEN t.type = 'income' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.status = 'paid' THEN t.amount ELSE 0 END), 0) as total_expenses
    FROM funds f
    LEFT JOIN transactions t ON f.id = t.source_of_funds_id
    WHERE f.id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5'
    GROUP BY f.current_balance
)
SELECT 
    'Dynamic calculation based on actual data:' as scenario,
    (actual_balance - (total_income - total_expenses)) as implied_initial_balance,
    total_income,
    total_expenses,
    (implied_initial_balance + total_income - total_expenses) as calculated_final_balance,
    actual_balance,
    (actual_balance - (implied_initial_balance + total_income - total_expenses)) as remaining_difference
FROM fund_calculations;

-- 5. Check if there might be missing income transactions around fund creation
SELECT '\nTransactions around fund creation date:' as section;
SELECT 
    t.id,
    t.type,
    t.amount,
    t.date,
    t.note,
    f.created_at as fund_created_at,
    ABS(EXTRACT(EPOCH FROM (t.date - f.created_at::date))/86400) as days_from_fund_creation
FROM transactions t
JOIN funds f ON t.source_of_funds_id = f.id
WHERE f.id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5'
AND t.date BETWEEN (f.created_at::date - INTERVAL '7 days') AND (f.created_at::date + INTERVAL '7 days')
ORDER BY t.date ASC;