-- Comprehensive BCA Balance Check
-- Verifying current balance of 30,303,304

-- 1. Get BCA Fund Details
SELECT 'BCA Fund Information:' as section;
SELECT 
    id,
    name,
    current_balance,
    status,
    created_at,
    CASE 
        WHEN current_balance > 0 THEN 'Fund created with initial balance'
        ELSE 'Fund created with zero balance'
    END as initial_balance_status
FROM funds 
WHERE name ILIKE '%BCA%' OR name ILIKE '%Bank Central Asia%';

-- 2. Check for Initial Balance Transactions
SELECT '\nInitial Balance Check:' as section;
SELECT 
    t.id,
    t.type,
    t.amount,
    t.date,
    t.created_at,
    t.note,
    f.name as fund_name,
    f.created_at as fund_created_at
FROM transactions t
JOIN funds f ON t.source_of_funds_id = f.id
WHERE (f.name ILIKE '%BCA%' OR f.name ILIKE '%Bank Central Asia%')
AND (t.note ILIKE '%initial%' 
     OR t.note ILIKE '%balance%' 
     OR t.note ILIKE '%opening%'
     OR t.note ILIKE '%starting%'
     OR t.type = 'income' AND t.date = (SELECT MIN(date) FROM transactions t2 WHERE t2.source_of_funds_id = f.id))
ORDER BY t.date ASC;

-- 3. Income vs Expense Analysis
SELECT '\nIncome vs Expense Summary:' as section;
SELECT 
    f.name as fund_name,
    f.id as fund_id,
    COUNT(CASE WHEN t.type = 'income' THEN 1 END) as income_count,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) as total_income,
    COUNT(CASE WHEN t.type = 'expense' THEN 1 END) as expense_count,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) as total_expenses,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) - 
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) as net_amount,
    f.current_balance
FROM funds f
LEFT JOIN transactions t ON f.id = t.source_of_funds_id
WHERE f.name ILIKE '%BCA%' OR f.name ILIKE '%Bank Central Asia%'
GROUP BY f.id, f.name, f.current_balance;

-- 4. Detailed Transaction History
SELECT '\nDetailed Transaction History:' as section;
SELECT 
    t.date,
    t.type,
    t.amount,
    t.note,
    c.name as category_name,
    sc.name as subcategory_name,
    t.created_at,
    -- Running balance calculation
    SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END) 
        OVER (ORDER BY t.date, t.created_at ROWS UNBOUNDED PRECEDING) as running_balance
FROM transactions t
JOIN funds f ON t.source_of_funds_id = f.id
LEFT JOIN categories c ON t.category = c.id
LEFT JOIN subcategories sc ON t.subcategory = sc.id
WHERE f.name ILIKE '%BCA%' OR f.name ILIKE '%Bank Central Asia%'
ORDER BY t.date ASC, t.created_at ASC;

-- 5. Balance Verification
SELECT '\nBalance Verification:' as section;
WITH bca_calculations AS (
    SELECT 
        f.name as fund_name,
        f.current_balance as recorded_balance,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) as total_expenses,
        COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) - 
        COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) as calculated_balance
    FROM funds f
    LEFT JOIN transactions t ON f.id = t.source_of_funds_id
    WHERE f.name ILIKE '%BCA%' OR f.name ILIKE '%Bank Central Asia%'
    GROUP BY f.id, f.name, f.current_balance
)
SELECT 
    fund_name,
    recorded_balance,
    total_income,
    total_expenses,
    calculated_balance,
    (recorded_balance - calculated_balance) as difference,
    CASE 
        WHEN recorded_balance = calculated_balance THEN '✓ BALANCE MATCHES'
        WHEN ABS(recorded_balance - calculated_balance) > 0 THEN '⚠ DISCREPANCY FOUND'
        ELSE '⚠ UNEXPECTED BALANCE'
    END as status,
    CASE 
        WHEN recorded_balance > 0 THEN '✓ Balance exists'
        ELSE '✗ No balance found'
    END as balance_status
FROM bca_calculations;

-- 6. Monthly Transaction Summary
SELECT '\nMonthly Transaction Summary:' as section;
SELECT 
    DATE_TRUNC('month', t.date) as month,
    COUNT(CASE WHEN t.type = 'income' THEN 1 END) as income_transactions,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) as monthly_income,
    COUNT(CASE WHEN t.type = 'expense' THEN 1 END) as expense_transactions,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) as monthly_expenses,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount END), 0) - 
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount END), 0) as monthly_net
FROM transactions t
JOIN funds f ON t.source_of_funds_id = f.id
WHERE f.name ILIKE '%BCA%' OR f.name ILIKE '%Bank Central Asia%'
GROUP BY DATE_TRUNC('month', t.date)
ORDER BY month DESC;

-- 7. Large Transactions Analysis
SELECT '\nLarge Transactions (>1,000,000):' as section;
SELECT 
    t.date,
    t.type,
    t.amount,
    t.note,
    c.name as category_name,
    sc.name as subcategory_name
FROM transactions t
JOIN funds f ON t.source_of_funds_id = f.id
LEFT JOIN categories c ON t.category = c.id
LEFT JOIN subcategories sc ON t.subcategory = sc.id
WHERE (f.name ILIKE '%BCA%' OR f.name ILIKE '%Bank Central Asia%')
AND t.amount > 1000000
ORDER BY t.amount DESC, t.date DESC;

-- 8. Recent Transactions (Last 30 days)
SELECT '\nRecent Transactions (Last 30 days):' as section;
SELECT 
    t.date,
    t.type,
    t.amount,
    t.note,
    c.name as category_name,
    sc.name as subcategory_name
FROM transactions t
JOIN funds f ON t.source_of_funds_id = f.id
LEFT JOIN categories c ON t.category = c.id
LEFT JOIN subcategories sc ON t.subcategory = sc.id
WHERE (f.name ILIKE '%BCA%' OR f.name ILIKE '%Bank Central Asia%')
AND t.date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY t.date DESC, t.created_at DESC;