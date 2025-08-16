-- Migration to add sub-category support to categories table
-- This allows categories to have parent-child relationships

-- Add parent_id column to categories table for hierarchical structure
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE CASCADE;

-- Add index for better performance on parent_id queries
CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON public.categories(parent_id);

-- Update the unique constraint to allow sub-categories with same name under different parents
-- First drop the existing unique constraint
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_id_name_type_key;

-- Add new unique constraint that includes parent_id
-- This allows same name for categories vs sub-categories, but prevents duplicates within same parent
ALTER TABLE public.categories 
ADD CONSTRAINT categories_user_id_name_type_parent_unique 
UNIQUE(user_id, name, type, parent_id);

-- Create a function to get category hierarchy path
CREATE OR REPLACE FUNCTION get_category_path(category_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    result TEXT := '';
    current_id UUID := category_uuid;
    current_name TEXT;
    parent_name TEXT;
BEGIN
    -- Get the current category name
    SELECT name INTO current_name FROM public.categories WHERE id = current_id;
    
    IF current_name IS NULL THEN
        RETURN NULL;
    END IF;
    
    result := current_name;
    
    -- Check if this category has a parent
    SELECT c.name, c.parent_id INTO parent_name, current_id 
    FROM public.categories c 
    WHERE c.id = (SELECT parent_id FROM public.categories WHERE id = category_uuid);
    
    -- If there's a parent, prepend it to the result
    IF parent_name IS NOT NULL THEN
        result := parent_name || ' > ' || result;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Create a view for easier querying of categories with their hierarchy
CREATE OR REPLACE VIEW categories_with_hierarchy AS
SELECT 
    c.*,
    p.name as parent_name,
    CASE 
        WHEN c.parent_id IS NULL THEN c.name
        ELSE p.name || ' > ' || c.name
    END as full_path,
    CASE 
        WHEN c.parent_id IS NULL THEN 'category'
        ELSE 'subcategory'
    END as category_type
FROM public.categories c
LEFT JOIN public.categories p ON c.parent_id = p.id;

-- Update the default categories function to not create duplicates
CREATE OR REPLACE FUNCTION create_default_categories_for_user(user_uuid UUID)
RETURNS void AS $$
BEGIN
  -- Only create default categories if user doesn't have any categories yet
  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE user_id = user_uuid) THEN
    -- Default expense categories
    INSERT INTO public.categories (user_id, name, type, emoji, budget_amount) VALUES
      (user_uuid, 'Food & Dining', 'expense', '🍔', 1000000),
      (user_uuid, 'Transportation', 'expense', '🚗', 500000),
      (user_uuid, 'Shopping', 'expense', '🛍️', 300000),
      (user_uuid, 'Entertainment', 'expense', '🎬', 200000),
      (user_uuid, 'Bills & Utilities', 'expense', '💡', 800000),
      (user_uuid, 'Healthcare', 'expense', '🏥', 300000),
      (user_uuid, 'Education', 'expense', '📚', 200000),
      (user_uuid, 'Travel', 'expense', '✈️', 500000),
      (user_uuid, 'Other', 'expense', '📝', 100000);
    
    -- Default income categories
    INSERT INTO public.categories (user_id, name, type, emoji, budget_amount) VALUES
      (user_uuid, 'Salary', 'income', '💰', 0),
      (user_uuid, 'Freelance', 'income', '💼', 0),
      (user_uuid, 'Business', 'income', '🏢', 0),
      (user_uuid, 'Investment', 'income', '📈', 0),
      (user_uuid, 'Gift', 'income', '🎁', 0),
      (user_uuid, 'Other', 'income', '📝', 0);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the new view
GRANT SELECT ON categories_with_hierarchy TO authenticated, anon;