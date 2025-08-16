-- Quick fix: Create main_categories and subcategories tables
-- Execute this in your Supabase SQL Editor

-- Create main_categories table
CREATE TABLE IF NOT EXISTS public.main_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
  emoji TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Create subcategories table
CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  main_category_id UUID REFERENCES public.main_categories(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT,
  budget_amount BIGINT DEFAULT 0,
  budget_period TEXT CHECK (budget_period IN ('weekly', 'monthly', 'yearly')) DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, main_category_id, name)
);

-- Enable RLS
ALTER TABLE public.main_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

-- Create policies for main_categories
CREATE POLICY "Users can view their own main categories" ON public.main_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own main categories" ON public.main_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own main categories" ON public.main_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own main categories" ON public.main_categories
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for subcategories
CREATE POLICY "Users can view their own subcategories" ON public.subcategories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subcategories" ON public.subcategories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subcategories" ON public.subcategories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subcategories" ON public.subcategories
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_main_categories_user_id ON public.main_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_main_categories_type ON public.main_categories(type);
CREATE INDEX IF NOT EXISTS idx_subcategories_user_id ON public.subcategories(user_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_main_category_id ON public.subcategories(main_category_id);

-- Create update triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_main_categories_updated_at
  BEFORE UPDATE ON public.main_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subcategories_updated_at
  BEFORE UPDATE ON public.subcategories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Note: Default categories will be created automatically when users first access the app
-- The application handles creating initial categories for authenticated users

SELECT 'Tables created successfully!' as result;