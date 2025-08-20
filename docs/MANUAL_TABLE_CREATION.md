# Manual Table Creation Required

The `parsing_history` table needs to be created manually in your Supabase database.

## Steps to Create the Table:

1. **Go to your Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Paste the SQL Below**
   - Copy the entire SQL script below
   - Paste it into the SQL editor
   - Click "Run" to execute

## SQL Script to Execute:

```sql
-- Create parsing_history table for storing AI data parser results
CREATE TABLE IF NOT EXISTS parsing_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  image_data TEXT NOT NULL, -- base64 encoded image
  openai_response JSONB,
  extracted_json JSONB,
  status TEXT CHECK (status IN ('success', 'error')) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_parsing_history_user_id ON parsing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_parsing_history_timestamp ON parsing_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_parsing_history_status ON parsing_history(status);

-- Enable Row Level Security (RLS)
ALTER TABLE parsing_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own parsing history
CREATE POLICY "Users can view own parsing history" ON parsing_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own parsing history
CREATE POLICY "Users can insert own parsing history" ON parsing_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own parsing history
CREATE POLICY "Users can update own parsing history" ON parsing_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own parsing history
CREATE POLICY "Users can delete own parsing history" ON parsing_history
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_parsing_history_updated_at
  BEFORE UPDATE ON parsing_history
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON parsing_history TO authenticated;
GRANT ALL ON parsing_history TO service_role;
```

## After Creating the Table:

1. Refresh your application at http://localhost:3000
2. The "Error fetching history" should be resolved
3. The data parser functionality should work properly

## Verification:

After running the SQL, you can verify the table was created by running this query in the SQL editor:

```sql
SELECT * FROM parsing_history LIMIT 1;
```

This should return an empty result (no error) if the table was created successfully.