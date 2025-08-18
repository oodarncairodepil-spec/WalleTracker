-- Database Cleanup Script
-- Execute these commands in order in your Supabase SQL Editor

-- Step 1: Drop the view first (since it's a view, not a table)
DROP VIEW IF EXISTS categories_with_hierarchy CASCADE;

-- Step 2: Check what foreign key constraints reference the categories table
-- Run this query first to see what needs to be dropped:
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM 
  information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE 
  tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'categories';

-- Step 3: Drop any foreign key constraints that reference categories
-- (Replace [constraint_name] and [table_name] with actual values from Step 2)
-- Example: ALTER TABLE some_table DROP CONSTRAINT some_constraint_name;

-- Step 4: Now drop the categories table
DROP TABLE IF EXISTS categories CASCADE;

-- Step 5: Remove unused emoji columns from remaining tables
ALTER TABLE main_categories DROP COLUMN IF EXISTS emoji;
ALTER TABLE subcategories DROP COLUMN IF EXISTS emoji;

-- Step 6: Remove unused category_id column from transactions
ALTER TABLE transactions DROP COLUMN IF EXISTS category_id;

-- Verification queries (run these to confirm cleanup)
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('categories', 'categories_with_hierarchy');

SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'main_categories';

SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'subcategories';

SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transactions';}}}