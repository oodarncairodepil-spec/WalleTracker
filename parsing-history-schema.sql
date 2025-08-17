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