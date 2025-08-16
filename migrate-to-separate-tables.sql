-- Migration script: Split single categories table into separate main_categories and subcategories tables
-- This migration safely preserves all existing data while eliminating naming confusion

-- Step 1: Create backup of existing categories table
CREATE TABLE IF NOT EXISTS public.categories_backup AS 
SELECT * FROM public.categories;

-- Step 2: Create new tables (main_categories and subcategories)
-- Execute the separate-tables-schema.sql first, then continue with this migration

-- Step 3: Migrate existing data
DO $$
DECLARE
    category_record RECORD;
    new_main_category_id UUID;
    existing_main_category_id UUID;
BEGIN
    -- First, migrate all main categories (those without parent_id)
    FOR category_record IN 
        SELECT * FROM public.categories WHERE parent_id IS NULL
    LOOP
        -- Insert into main_categories table
        INSERT INTO public.main_categories (
            id, user_id, name, type, emoji, is_active, created_at, updated_at
        ) VALUES (
            category_record.id,
            category_record.user_id,
            category_record.name,
            category_record.type,
            category_record.emoji,
            category_record.is_active,
            category_record.created_at,
            category_record.updated_at
        );
        
        RAISE NOTICE 'Migrated main category: % (ID: %)', category_record.name, category_record.id;
    END LOOP;
    
    -- Then, migrate all subcategories (those with parent_id)
    FOR category_record IN 
        SELECT * FROM public.categories WHERE parent_id IS NOT NULL
    LOOP
        -- Check if the parent category exists in main_categories
        SELECT id INTO existing_main_category_id 
        FROM public.main_categories 
        WHERE id = category_record.parent_id;
        
        IF existing_main_category_id IS NOT NULL THEN
            -- Insert into subcategories table
            INSERT INTO public.subcategories (
                id, user_id, main_category_id, name, emoji, 
                budget_amount, budget_period, is_active, created_at, updated_at
            ) VALUES (
                category_record.id,
                category_record.user_id,
                category_record.parent_id,
                category_record.name,
                category_record.emoji,
                category_record.budget_amount,
                category_record.budget_period,
                category_record.is_active,
                category_record.created_at,
                category_record.updated_at
            );
            
            RAISE NOTICE 'Migrated subcategory: % under % (ID: %)', 
                category_record.name, 
                (SELECT name FROM public.main_categories WHERE id = category_record.parent_id),
                category_record.id;
        ELSE
            RAISE WARNING 'Orphaned subcategory found: % (ID: %) - parent % not found', 
                category_record.name, category_record.id, category_record.parent_id;
        END IF;
    END LOOP;
END $$;

-- Step 4: Update transactions table to reference the new structure
-- Add new columns for the separate table references
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS main_category_id UUID REFERENCES public.main_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL;

-- Migrate transaction references
DO $$
DECLARE
    transaction_record RECORD;
    category_info RECORD;
BEGIN
    FOR transaction_record IN 
        SELECT id, category_id FROM public.transactions WHERE category_id IS NOT NULL
    LOOP
        -- Check if the category_id exists in main_categories
        SELECT id, 'main' as table_type INTO category_info
        FROM public.main_categories 
        WHERE id = transaction_record.category_id
        
        UNION ALL
        
        SELECT sc.id, 'sub' as table_type
        FROM public.subcategories sc
        WHERE sc.id = transaction_record.category_id;
        
        IF category_info.table_type = 'main' THEN
            UPDATE public.transactions 
            SET main_category_id = transaction_record.category_id
            WHERE id = transaction_record.id;
        ELSIF category_info.table_type = 'sub' THEN
            UPDATE public.transactions 
            SET 
                subcategory_id = transaction_record.category_id,
                main_category_id = (SELECT main_category_id FROM public.subcategories WHERE id = transaction_record.category_id)
            WHERE id = transaction_record.id;
        END IF;
    END LOOP;
END $$;

-- Step 5: Create indexes for the new transaction columns
CREATE INDEX IF NOT EXISTS idx_transactions_main_category_id ON public.transactions(main_category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subcategory_id ON public.transactions(subcategory_id);

-- Step 6: Verification queries
-- Run these to verify the migration was successful

-- Check migration results
SELECT 
    'Original categories' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as main_categories,
    COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as subcategories
FROM public.categories

UNION ALL

SELECT 
    'New main_categories' as table_name,
    COUNT(*) as total_count,
    COUNT(*) as main_categories,
    0 as subcategories
FROM public.main_categories

UNION ALL

SELECT 
    'New subcategories' as table_name,
    COUNT(*) as total_count,
    0 as main_categories,
    COUNT(*) as subcategories
FROM public.subcategories;

-- Check for any orphaned data
SELECT 
    'Orphaned subcategories' as issue_type,
    COUNT(*) as count
FROM public.categories c
WHERE c.parent_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.main_categories mc WHERE mc.id = c.parent_id)

UNION ALL

SELECT 
    'Transactions with old category_id' as issue_type,
    COUNT(*) as count
FROM public.transactions t
WHERE t.category_id IS NOT NULL 
  AND t.main_category_id IS NULL 
  AND t.subcategory_id IS NULL;

-- Step 7: After verification, you can optionally rename/drop the old table
-- IMPORTANT: Only run these after confirming the migration was successful!

-- Rename old categories table (keep as backup)
-- ALTER TABLE public.categories RENAME TO categories_old;

-- Or drop old columns from transactions (after confirming new columns work)
-- ALTER TABLE public.transactions DROP COLUMN IF EXISTS category_id;
-- ALTER TABLE public.transactions DROP COLUMN IF EXISTS category;

-- Create a function to get category display name for transactions
CREATE OR REPLACE FUNCTION get_transaction_category_display(main_cat_id UUID, sub_cat_id UUID)
RETURNS TEXT AS $$
DECLARE
    main_name TEXT;
    sub_name TEXT;
BEGIN
    -- Get main category name
    SELECT name INTO main_name FROM public.main_categories WHERE id = main_cat_id;
    
    -- If there's a subcategory, get its name too
    IF sub_cat_id IS NOT NULL THEN
        SELECT name INTO sub_name FROM public.subcategories WHERE id = sub_cat_id;
        RETURN main_name || ' > ' || sub_name;
    ELSE
        RETURN main_name;
    END IF;
END;
$$ LANGUAGE plpgsql;

RAISE NOTICE 'Migration completed! Please verify the results using the verification queries above.';
RAISE NOTICE 'After verification, you can optionally clean up the old categories table.';