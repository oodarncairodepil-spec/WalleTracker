-- Fix BCA fund balance by removing the implied initial balance
-- Current balance: 59,031,951
-- Calculated balance from transactions: 26,908,065
-- Implied initial balance to remove: 32,123,886

-- First, let's check the current state
SELECT 
    f.name,
    f.balance as current_balance,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) as calculated_balance,
    f.balance - COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) as implied_initial_balance
FROM funds f
LEFT JOIN transactions t ON f.id = t.fund_id
WHERE f.name = 'BCA'
GROUP BY f.id, f.name, f.balance;

-- Update the BCA fund balance to the correct calculated value
UPDATE funds 
SET balance = (
    SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)
    FROM transactions t 
    WHERE t.fund_id = funds.id
)
WHERE name = 'BCA';

-- Verify the update
SELECT 
    f.name,
    f.balance as updated_balance,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) as total_income,
    COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as total_expense,
    COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) as calculated_balance,
    f.balance - COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0) as remaining_discrepancy
FROM funds f
LEFT JOIN transactions t ON f.id = t.fund_id
WHERE f.name = 'BCA'
GROUP BY f.id, f.name, f.balance;