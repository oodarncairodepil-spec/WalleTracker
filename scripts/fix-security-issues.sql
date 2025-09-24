-- Fix Database Security Issues
-- This script addresses the security definer views and RLS issues identified by Supabase linter

-- 1. Fix categories_with_hierarchy view to use SECURITY INVOKER
-- Drop existing view if it exists
DROP VIEW IF EXISTS public.categories_with_hierarchy CASCADE;

-- Recreate the view with SECURITY INVOKER
CREATE VIEW public.categories_with_hierarchy
    WITH (security_invoker=on)
    AS
SELECT 
    mc.id as main_category_id,
    mc.name as main_category_name,
    mc.type as category_type,
    mc.user_id,
    sc.id as subcategory_id,
    sc.name as subcategory_name,
    sc.budget_amount,
    sc.budget_period,
    mc.created_at as main_category_created_at,
    sc.created_at as subcategory_created_at
FROM main_categories mc
LEFT JOIN subcategories sc ON mc.id = sc.main_category_id
ORDER BY mc.name, sc.name;

-- Grant access to the view
GRANT SELECT ON public.categories_with_hierarchy TO authenticated;

-- 2. Fix budget_performance_summary view to use SECURITY INVOKER
-- Drop existing view if it exists
DROP VIEW IF EXISTS public.budget_performance_summary CASCADE;

-- Recreate the view with SECURITY INVOKER
CREATE VIEW public.budget_performance_summary
    WITH (security_invoker=on)
    AS
SELECT 
  b.user_id,
  b.period_start_date,
  b.period_end_date,
  b.category_type,
  COUNT(*) as total_categories,
  SUM(b.budgeted_amount) as total_budgeted,
  SUM(b.actual_amount) as total_actual,
  SUM(b.variance_amount) as total_variance,
  ROUND(AVG(b.variance_percentage), 2) as avg_variance_percentage,
  COUNT(CASE WHEN b.variance_amount > 0 THEN 1 END) as categories_over_budget,
  COUNT(CASE WHEN b.variance_amount < 0 THEN 1 END) as categories_under_budget,
  COUNT(CASE WHEN b.variance_amount = 0 THEN 1 END) as categories_on_target
FROM budgets b
WHERE b.is_active = true
GROUP BY b.user_id, b.period_start_date, b.period_end_date, b.category_type;

-- Grant access to the view
GRANT SELECT ON public.budget_performance_summary TO authenticated;

-- 3. Enable Row Level Security on bulk_orders_backup table
-- First check if the table exists, if not create it
CREATE TABLE IF NOT EXISTS public.bulk_orders_backup (
    id UUID,
    user_id UUID,
    title TEXT,
    description TEXT,
    total_amount BIGINT,
    status TEXT,
    source_of_funds_id UUID,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Add backup_created_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'bulk_orders_backup' 
                   AND column_name = 'backup_created_at') THEN
        ALTER TABLE public.bulk_orders_backup 
        ADD COLUMN backup_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.bulk_orders_backup ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bulk_orders_backup
-- Policy for SELECT
CREATE POLICY "Users can view their own bulk orders backup" 
ON public.bulk_orders_backup
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy for INSERT (if needed for backup operations)
CREATE POLICY "Users can insert their own bulk orders backup" 
ON public.bulk_orders_backup
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy for UPDATE (if needed)
CREATE POLICY "Users can update their own bulk orders backup" 
ON public.bulk_orders_backup
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy for DELETE (if needed)
CREATE POLICY "Users can delete their own bulk orders backup" 
ON public.bulk_orders_backup
FOR DELETE 
USING (auth.uid() = user_id);

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_orders_backup TO authenticated;
GRANT ALL ON public.bulk_orders_backup TO service_role;

-- Add comments for documentation
COMMENT ON VIEW public.categories_with_hierarchy IS 'Hierarchical view of categories and subcategories with SECURITY INVOKER for proper RLS enforcement';
COMMENT ON VIEW public.budget_performance_summary IS 'Budget performance summary view with SECURITY INVOKER for proper RLS enforcement';
COMMENT ON TABLE public.bulk_orders_backup IS 'Backup table for bulk orders with RLS enabled for security';

-- Create indexes for better performance on backup table
CREATE INDEX IF NOT EXISTS idx_bulk_orders_backup_user_id ON public.bulk_orders_backup(user_id);
-- Only create backup_created_at index if column exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'bulk_orders_backup' 
               AND column_name = 'backup_created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_bulk_orders_backup_created_at ON public.bulk_orders_backup(backup_created_at DESC);
    END IF;
END $$;

SELECT 'Security issues have been fixed:' as status;
SELECT '1. categories_with_hierarchy view recreated with SECURITY INVOKER' as fix_1;
SELECT '2. budget_performance_summary view recreated with SECURITY INVOKER' as fix_2;
SELECT '3. bulk_orders_backup table has RLS enabled with proper policies' as fix_3;