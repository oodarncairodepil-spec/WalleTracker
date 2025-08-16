-- Fix sub-category unique constraint issue
-- This migration addresses the duplicate key constraint error when creating sub-categories

-- Drop the existing constraint that's too restrictive
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_id_name_type_parent_unique;

-- Create a more flexible constraint that allows:
-- 1. Same category name under different parents
-- 2. Same category name for main categories vs sub-categories
-- 3. Prevents true duplicates (same name, type, user, and parent)
ALTER TABLE public.categories 
ADD CONSTRAINT categories_user_id_name_type_parent_unique 
UNIQUE(user_id, name, type, COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Alternative approach: Use a partial unique index instead
-- This allows NULL parent_id values to not conflict with each other
DROP INDEX IF EXISTS idx_categories_unique_main;
DROP INDEX IF EXISTS idx_categories_unique_sub;

-- Unique constraint for main categories (parent_id IS NULL)
CREATE UNIQUE INDEX idx_categories_unique_main 
ON public.categories(user_id, name, type) 
WHERE parent_id IS NULL;

-- Unique constraint for sub-categories (parent_id IS NOT NULL)
CREATE UNIQUE INDEX idx_categories_unique_sub 
ON public.categories(user_id, name, type, parent_id) 
WHERE parent_id IS NOT NULL;

-- Remove the constraint we just added since we're using partial indexes instead
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_id_name_type_parent_unique;