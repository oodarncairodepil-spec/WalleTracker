-- Create budget tables for period-based financial tracking and performance analysis
-- This script creates two main tables: budgets and budget_history

-- Main budget table for current period budgets
CREATE TABLE IF NOT EXISTS budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Period information
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  period_type TEXT CHECK (period_type IN ('monthly', 'weekly', 'yearly', 'custom')) DEFAULT 'monthly' NOT NULL,
  
  -- Category information (supports both main categories and subcategories)
  main_category_id UUID REFERENCES main_categories(id) ON DELETE CASCADE,
  subcategory_id UUID REFERENCES subcategories(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL, -- Denormalized for easier querying
  category_type TEXT CHECK (category_type IN ('income', 'expense')) NOT NULL,
  
  -- Budget amounts (stored in cents/smallest currency unit)
  budgeted_amount BIGINT NOT NULL DEFAULT 0,
  actual_amount BIGINT NOT NULL DEFAULT 0,
  
  -- Performance metrics (calculated fields)
  variance_amount BIGINT GENERATED ALWAYS AS (actual_amount - budgeted_amount) STORED,
  variance_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN budgeted_amount = 0 THEN 0
      ELSE ROUND(((actual_amount - budgeted_amount)::DECIMAL / budgeted_amount) * 100, 2)
    END
  ) STORED,
  
  -- Status tracking
  is_active BOOLEAN DEFAULT true,
  is_finalized BOOLEAN DEFAULT false, -- True when period is closed
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT budgets_category_check CHECK (
    (main_category_id IS NOT NULL AND subcategory_id IS NULL) OR
    (main_category_id IS NULL AND subcategory_id IS NOT NULL)
  ),
  
  -- Unique constraint to prevent duplicate budgets for same period/category
  UNIQUE(user_id, period_start_date, period_end_date, main_category_id, subcategory_id)
);

-- Budget history table for tracking finalized periods
CREATE TABLE IF NOT EXISTS budget_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Period information
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  period_type TEXT CHECK (period_type IN ('monthly', 'weekly', 'yearly', 'custom')) NOT NULL,
  period_description TEXT, -- Human readable period description
  
  -- Category information
  main_category_id UUID, -- May reference deleted categories
  subcategory_id UUID,   -- May reference deleted categories
  category_name TEXT NOT NULL,
  category_type TEXT CHECK (category_type IN ('income', 'expense')) NOT NULL,
  
  -- Final amounts at period close
  budgeted_amount BIGINT NOT NULL,
  actual_amount BIGINT NOT NULL,
  variance_amount BIGINT NOT NULL,
  variance_percentage DECIMAL(5,2) NOT NULL,
  
  -- Performance classification
  performance_status TEXT CHECK (performance_status IN ('surplus', 'deficit', 'on_target')) NOT NULL,
  
  -- Metadata
  notes TEXT,
  finalized_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_budgets_user_period 
  ON budgets(user_id, period_start_date, period_end_date);

CREATE INDEX IF NOT EXISTS idx_budgets_user_active 
  ON budgets(user_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_budgets_category_type 
  ON budgets(user_id, category_type, period_start_date);

CREATE INDEX IF NOT EXISTS idx_budgets_main_category 
  ON budgets(main_category_id) WHERE main_category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_budgets_subcategory 
  ON budgets(subcategory_id) WHERE subcategory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_budget_history_user_period 
  ON budget_history(user_id, period_start_date, period_end_date);

CREATE INDEX IF NOT EXISTS idx_budget_history_performance 
  ON budget_history(user_id, performance_status, period_start_date);

-- Enable Row Level Security
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for budgets table
CREATE POLICY "Users can view their own budgets" ON budgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets" ON budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets" ON budgets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets" ON budgets
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for budget_history table
CREATE POLICY "Users can view their own budget history" ON budget_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budget history" ON budget_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for budgets table
CREATE TRIGGER update_budgets_updated_at 
  BEFORE UPDATE ON budgets 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to finalize budget period
CREATE OR REPLACE FUNCTION finalize_budget_period(
  p_user_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS VOID AS $$
BEGIN
  -- Insert finalized budgets into history
  INSERT INTO budget_history (
    user_id,
    period_start_date,
    period_end_date,
    period_type,
    period_description,
    main_category_id,
    subcategory_id,
    category_name,
    category_type,
    budgeted_amount,
    actual_amount,
    variance_amount,
    variance_percentage,
    performance_status,
    notes,
    finalized_at
  )
  SELECT 
    user_id,
    period_start_date,
    period_end_date,
    period_type,
    CONCAT(
      TO_CHAR(period_start_date, 'DD Mon'), 
      ' - ', 
      TO_CHAR(period_end_date, 'DD Mon YYYY')
    ) as period_description,
    main_category_id,
    subcategory_id,
    category_name,
    category_type,
    budgeted_amount,
    actual_amount,
    variance_amount,
    variance_percentage,
    CASE 
      WHEN category_type = 'expense' THEN
        CASE 
          WHEN actual_amount < budgeted_amount THEN 'surplus'
          WHEN actual_amount > budgeted_amount THEN 'deficit'
          ELSE 'on_target'
        END
      WHEN category_type = 'income' THEN
        CASE 
          WHEN actual_amount >= budgeted_amount THEN 'surplus'
          WHEN actual_amount < budgeted_amount THEN 'deficit'
          ELSE 'on_target'
        END
    END as performance_status,
    notes,
    NOW() as finalized_at
  FROM budgets 
  WHERE user_id = p_user_id 
    AND period_start_date = p_period_start 
    AND period_end_date = p_period_end
    AND is_active = true;
  
  -- Mark budgets as finalized
  UPDATE budgets 
  SET is_finalized = true, 
      is_active = false,
      updated_at = NOW()
  WHERE user_id = p_user_id 
    AND period_start_date = p_period_start 
    AND period_end_date = p_period_end
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION finalize_budget_period(UUID, DATE, DATE) TO authenticated;

-- Create view for budget performance summary
CREATE OR REPLACE VIEW budget_performance_summary AS
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
GRANT SELECT ON budget_performance_summary TO authenticated;

-- Create indexes on the view's underlying columns for better performance
CREATE INDEX IF NOT EXISTS idx_budgets_performance_summary 
  ON budgets(user_id, period_start_date, period_end_date, category_type, is_active);

COMMENT ON TABLE budgets IS 'Stores current period budgets with real-time actual amounts and performance metrics';
COMMENT ON TABLE budget_history IS 'Stores finalized budget periods for historical analysis and reporting';
COMMENT ON FUNCTION finalize_budget_period IS 'Finalizes a budget period by moving active budgets to history';
COMMENT ON VIEW budget_performance_summary IS 'Provides aggregated budget performance metrics by period and category type';