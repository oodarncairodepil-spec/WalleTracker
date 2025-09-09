-- Create user_preferences table for storing custom date range and other user settings
-- This table will store user-specific preferences including custom financial periods

CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Custom date range settings
  custom_period_enabled BOOLEAN DEFAULT FALSE,
  custom_period_start_day INTEGER DEFAULT 1, -- Day of month (1-31)
  custom_period_end_day INTEGER DEFAULT 31,  -- Day of month (1-31)
  
  -- Other potential preferences for future use
  currency_preference VARCHAR(10) DEFAULT 'IDR',
  date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one preference record per user
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Create policy for users to only access their own preferences
CREATE POLICY "Users can view their own preferences" ON user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" ON user_preferences
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- Insert default preferences for existing users (optional)
-- This will create default preferences for users who don't have them yet
INSERT INTO user_preferences (user_id, custom_period_enabled, custom_period_start_day, custom_period_end_day)
SELECT 
  id as user_id,
  FALSE as custom_period_enabled,
  1 as custom_period_start_day,
  31 as custom_period_end_day
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM user_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- Verify table creation
SELECT 'user_preferences table created successfully' as status;