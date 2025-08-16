-- Create funds table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS funds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  balance DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for funds table
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;

-- Create policies for funds (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own funds" ON funds;
DROP POLICY IF EXISTS "Users can insert own funds" ON funds;
DROP POLICY IF EXISTS "Users can update own funds" ON funds;
DROP POLICY IF EXISTS "Users can delete own funds" ON funds;

CREATE POLICY "Users can view own funds" ON funds
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own funds" ON funds
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own funds" ON funds
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own funds" ON funds
  FOR DELETE USING (auth.uid() = user_id);

-- Add missing columns to transactions table if they don't exist
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS source_of_funds_id UUID REFERENCES funds(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('paid', 'unpaid')) DEFAULT 'paid',
ADD COLUMN IF NOT EXISTS note TEXT;

-- Create trigger for funds updated_at (drop existing first to avoid conflicts)
DROP TRIGGER IF EXISTS update_funds_updated_at ON funds;

CREATE TRIGGER update_funds_updated_at
  BEFORE UPDATE ON funds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();