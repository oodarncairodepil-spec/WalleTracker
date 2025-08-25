-- Investigation script for BLU fund balance discrepancy
-- Expected: 1,000,000 - 101,567 = 898,433
-- Actual: 1,895,732
-- Missing: 997,299

-- 1. Check for Internal Transfers TO BLU fund (these would be income but might not show as regular income)
SELECT 'Internal Transfers TO BLU:' as section;
SELECT 
    t.id,
    t.type,
    t.amount,
    t.category,
    t.date,
    t.note,
    t.destination_fund_id,
    source_fund.name as source_fund_name,
    dest_fund.name as destination_fund_name
FROM transactions t
JOIN funds source_fund ON t.source_of_funds_id = source_fund.id
LEFT JOIN funds dest_fund ON t.destination_fund_id = dest_fund.id
WHERE t.destination_fund_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' -- BLU fund ID
AND t.type = 'expense' -- Internal transfers are recorded as expenses from source
ORDER BY t.date DESC;

-- 2. Check for Internal Transfers FROM BLU fund (these should be expenses)
SELECT '\nInternal Transfers FROM BLU:' as section;
SELECT 
    t.id,
    t.type,
    t.amount,
    t.category,
    t.date,
    t.note,
    t.destination_fund_id,
    source_fund.name as source_fund_name,
    dest_fund.name as destination_fund_name
FROM transactions t
JOIN funds source_fund ON t.source_of_funds_id = source_fund.id
LEFT JOIN funds dest_fund ON t.destination_fund_id = dest_fund.id
WHERE t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' -- BLU fund ID
AND t.destination_fund_id IS NOT NULL -- Has a destination (internal transfer)
ORDER BY t.date DESC;

-- 3. Check ALL transactions for BLU fund (including any we might have missed)
SELECT '\nALL BLU Transactions (including internal transfers):' as section;
SELECT 
    t.id,
    t.type,
    t.amount,
    t.category,
    t.date,
    t.status,
    t.note,
    t.destination_fund_id,
    source_fund.name as source_fund_name,
    dest_fund.name as destination_fund_name,
    CASE 
        WHEN t.destination_fund_id IS NOT NULL THEN 'Internal Transfer'
        ELSE 'Regular Transaction'
    END as transaction_nature
FROM transactions t
JOIN funds source_fund ON t.source_of_funds_id = source_fund.id
LEFT JOIN funds dest_fund ON t.destination_fund_id = dest_fund.id
WHERE t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' -- BLU as source
OR t.destination_fund_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' -- BLU as destination
ORDER BY t.date DESC;

-- 4. Calculate COMPLETE balance including internal transfers
SELECT '\nComplete Balance Calculation:' as section;
SELECT 
    'BLU' as fund_name,
    1895732 as current_balance,
    
    -- Regular income
    COALESCE(SUM(CASE WHEN t.type = 'income' AND t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' AND t.destination_fund_id IS NULL THEN t.amount ELSE 0 END), 0) as regular_income,
    
    -- Regular expenses
    COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' AND t.destination_fund_id IS NULL THEN t.amount ELSE 0 END), 0) as regular_expenses,
    
    -- Transfers IN (money coming to BLU from other funds)
    COALESCE(SUM(CASE WHEN t.destination_fund_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' THEN t.amount ELSE 0 END), 0) as transfers_in,
    
    -- Transfers OUT (money going from BLU to other funds)
    COALESCE(SUM(CASE WHEN t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' AND t.destination_fund_id IS NOT NULL THEN t.amount ELSE 0 END), 0) as transfers_out,
    
    -- Calculate expected balance
    COALESCE(SUM(CASE WHEN t.type = 'income' AND t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' AND t.destination_fund_id IS NULL THEN t.amount ELSE 0 END), 0) +
    COALESCE(SUM(CASE WHEN t.destination_fund_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' THEN t.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' AND t.destination_fund_id IS NULL THEN t.amount ELSE 0 END), 0) -
    COALESCE(SUM(CASE WHEN t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' AND t.destination_fund_id IS NOT NULL THEN t.amount ELSE 0 END), 0) as calculated_balance,
    
    -- Difference
    1895732 - (
        COALESCE(SUM(CASE WHEN t.type = 'income' AND t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' AND t.destination_fund_id IS NULL THEN t.amount ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN t.destination_fund_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.type = 'expense' AND t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' AND t.destination_fund_id IS NULL THEN t.amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' AND t.destination_fund_id IS NOT NULL THEN t.amount ELSE 0 END), 0)
    ) as remaining_difference
    
FROM transactions t
WHERE (t.source_of_funds_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5' OR t.destination_fund_id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5')
AND t.status = 'paid';

-- 5. Check if there are any manual balance adjustments or initial balances
SELECT '\nFund Creation and History:' as section;
SELECT 
    id,
    name,
    current_balance,
    status,
    created_at
FROM funds 
WHERE id = '70dbcb6f-6794-4cb8-a85f-7f24996c4eb5';