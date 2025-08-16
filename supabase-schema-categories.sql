-- Categories table for expense/income categorization with budgets
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('income', 'expense')) NOT NULL,
  emoji VARCHAR(10) DEFAULT '📝',
  budget_amount DECIMAL(15,2) DEFAULT 0,
  budget_period VARCHAR(20) CHECK (budget_period IN ('monthly', 'weekly', 'yearly')) DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, name, type)
);

-- Enable Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;

-- Create RLS policies for categories
CREATE POLICY "Users can view own categories" ON public.categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

-- Add category_id to transactions table if it doesn't exist
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_type ON public.categories(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON public.transactions(category_id);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;

-- Create trigger for categories
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON public.categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories for new users (optional)
-- This can be done via a function that's called when a new user signs up
CREATE OR REPLACE FUNCTION create_default_categories_for_user(user_uuid UUID)
RETURNS void AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.categories TO authenticated;
GRANT SELECT ON public.categories TO anon;