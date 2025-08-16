-- New schema design: Separate tables for categories and subcategories
-- This eliminates naming confusion and makes the structure clearer

-- Main categories table (no budget, as budgets are set at subcategory level)
CREATE TABLE IF NOT EXISTS public.main_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('income', 'expense')) NOT NULL,
  emoji VARCHAR(10) DEFAULT '📝',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Unique constraint: user can't have duplicate main category names per type
  UNIQUE(user_id, name, type)
);

-- Subcategories table (with budgets)
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  main_category_id UUID REFERENCES public.main_categories(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  emoji VARCHAR(10) DEFAULT '📝',
  budget_amount DECIMAL(15,2) DEFAULT 0,
  budget_period VARCHAR(20) CHECK (budget_period IN ('monthly', 'weekly', 'yearly')) DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Unique constraint: user can't have duplicate subcategory names under the same main category
  UNIQUE(user_id, main_category_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.main_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- RLS policies for main_categories
CREATE POLICY "Users can view own main categories" ON public.main_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own main categories" ON public.main_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own main categories" ON public.main_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own main categories" ON public.main_categories
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for subcategories
CREATE POLICY "Users can view own subcategories" ON public.subcategories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subcategories" ON public.subcategories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subcategories" ON public.subcategories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own subcategories" ON public.subcategories
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_main_categories_user_id ON public.main_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_main_categories_type ON public.main_categories(type);
CREATE INDEX IF NOT EXISTS idx_subcategories_user_id ON public.subcategories(user_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_main_category_id ON public.subcategories(main_category_id);

-- Update triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for main_categories
CREATE TRIGGER update_main_categories_updated_at
    BEFORE UPDATE ON public.main_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers for subcategories
CREATE TRIGGER update_subcategories_updated_at
    BEFORE UPDATE ON public.subcategories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- View to get categories with subcategories (for easier querying)
CREATE OR REPLACE VIEW categories_with_subcategories AS
SELECT 
    mc.id as main_category_id,
    mc.name as main_category_name,
    mc.type as category_type,
    mc.emoji as main_category_emoji,
    mc.user_id,
    sc.id as subcategory_id,
    sc.name as subcategory_name,
    sc.emoji as subcategory_emoji,
    sc.budget_amount,
    sc.budget_period,
    CASE 
        WHEN sc.id IS NOT NULL THEN mc.name || ' > ' || sc.name
        ELSE mc.name
    END as full_path,
    CASE 
        WHEN sc.id IS NOT NULL THEN 'subcategory'
        ELSE 'main_category'
    END as item_type
FROM public.main_categories mc
LEFT JOIN public.subcategories sc ON mc.id = sc.main_category_id
WHERE mc.is_active = true AND (sc.is_active = true OR sc.id IS NULL)
ORDER BY mc.name, sc.name;

-- Grant permissions for the view
GRANT SELECT ON categories_with_subcategories TO authenticated, anon;

-- Function to create default categories for new users
CREATE OR REPLACE FUNCTION create_default_categories_for_user_v2(user_uuid UUID)
RETURNS void AS $$
DECLARE
    transportation_id UUID;
    food_id UUID;
    entertainment_id UUID;
    bills_id UUID;
    healthcare_id UUID;
    education_id UUID;
    travel_id UUID;
    other_expense_id UUID;
    salary_id UUID;
    freelance_id UUID;
    business_id UUID;
    investment_id UUID;
    gift_id UUID;
    other_income_id UUID;
BEGIN
  -- Only create default categories if user doesn't have any main categories yet
  IF NOT EXISTS (SELECT 1 FROM public.main_categories WHERE user_id = user_uuid) THEN
    
    -- Create default expense main categories
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Food & Dining', 'expense', '🍔') RETURNING id INTO food_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Transportation', 'expense', '🚗') RETURNING id INTO transportation_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Entertainment', 'expense', '🎬') RETURNING id INTO entertainment_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Bills & Utilities', 'expense', '💡') RETURNING id INTO bills_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Healthcare', 'expense', '🏥') RETURNING id INTO healthcare_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Education', 'expense', '📚') RETURNING id INTO education_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Travel', 'expense', '✈️') RETURNING id INTO travel_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Other', 'expense', '📝') RETURNING id INTO other_expense_id;
    
    -- Create default income main categories
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Salary', 'income', '💰') RETURNING id INTO salary_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Freelance', 'income', '💼') RETURNING id INTO freelance_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Business', 'income', '🏢') RETURNING id INTO business_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Investment', 'income', '📈') RETURNING id INTO investment_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Gift', 'income', '🎁') RETURNING id INTO gift_id;
    INSERT INTO public.main_categories (user_id, name, type, emoji) VALUES
      (user_uuid, 'Other', 'income', '📝') RETURNING id INTO other_income_id;
    
    -- Create some default subcategories
    -- Transportation subcategories
    INSERT INTO public.subcategories (user_id, main_category_id, name, emoji, budget_amount) VALUES
      (user_uuid, transportation_id, 'KRL', '🚊', 200000),
      (user_uuid, transportation_id, 'KA Bandara', '✈️', 300000),
      (user_uuid, transportation_id, 'Bus', '🚌', 150000),
      (user_uuid, transportation_id, 'Taxi/Ride Share', '🚕', 400000),
      (user_uuid, transportation_id, 'Fuel', '⛽', 500000);
    
    -- Food & Dining subcategories
    INSERT INTO public.subcategories (user_id, main_category_id, name, emoji, budget_amount) VALUES
      (user_uuid, food_id, 'Restaurants', '🍽️', 800000),
      (user_uuid, food_id, 'Fast Food', '🍔', 300000),
      (user_uuid, food_id, 'Groceries', '🛒', 1000000),
      (user_uuid, food_id, 'Coffee & Drinks', '☕', 200000);
    
    -- Entertainment subcategories
    INSERT INTO public.subcategories (user_id, main_category_id, name, emoji, budget_amount) VALUES
      (user_uuid, entertainment_id, 'Movies', '🎬', 150000),
      (user_uuid, entertainment_id, 'Games', '🎮', 200000),
      (user_uuid, entertainment_id, 'Streaming Services', '📺', 100000);
    
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.main_categories TO authenticated;
GRANT ALL ON public.subcategories TO authenticated;
GRANT SELECT ON public.main_categories TO anon;
GRANT SELECT ON public.subcategories TO anon;