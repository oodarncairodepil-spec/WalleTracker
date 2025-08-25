const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createJSONParserHistoryTable() {
  console.log('Creating json_parser_history table...')
  
  try {
    // Test if we can access the database
    const { data: testData, error: testError } = await supabase
      .from('parsing_history')
      .select('count', { count: 'exact' })
      .limit(1)
    
    if (testError) {
      console.error('Cannot access database:', testError)
      return false
    }
    
    console.log('Database connection successful')
    
    // Since we can't execute DDL directly, let's provide instructions
    console.log('\n📋 Please execute the following SQL in your Supabase SQL Editor:')
    console.log('\n-- Create json_parser_history table for storing JSON parser results')
    console.log('CREATE TABLE IF NOT EXISTS json_parser_history (')
    console.log('  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,')
    console.log('  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,')
    console.log('  record_id TEXT NOT NULL,')
    console.log('  timestamp TIMESTAMPTZ DEFAULT NOW(),')
    console.log('  json_input TEXT NOT NULL, -- Original JSON input')
    console.log('  extracted_data JSONB, -- Extracted transaction data')
    console.log('  status TEXT CHECK (status IN (\'success\', \'error\', \'converted\')) NOT NULL,')
    console.log('  error_message TEXT,')
    console.log('  created_at TIMESTAMPTZ DEFAULT NOW(),')
    console.log('  updated_at TIMESTAMPTZ DEFAULT NOW()')
    console.log(');')
    console.log('')
    console.log('-- Create indexes for faster queries')
    console.log('CREATE INDEX IF NOT EXISTS idx_json_parser_history_user_id ON json_parser_history(user_id);')
    console.log('CREATE INDEX IF NOT EXISTS idx_json_parser_history_timestamp ON json_parser_history(timestamp DESC);')
    console.log('CREATE INDEX IF NOT EXISTS idx_json_parser_history_status ON json_parser_history(status);')
    console.log('')
    console.log('-- Enable Row Level Security (RLS)')
    console.log('ALTER TABLE json_parser_history ENABLE ROW LEVEL SECURITY;')
    console.log('')
    console.log('-- Create RLS policies')
    console.log('CREATE POLICY "Users can view own json parser history" ON json_parser_history')
    console.log('  FOR SELECT USING (auth.uid() = user_id);')
    console.log('')
    console.log('CREATE POLICY "Users can insert own json parser history" ON json_parser_history')
    console.log('  FOR INSERT WITH CHECK (auth.uid() = user_id);')
    console.log('')
    console.log('CREATE POLICY "Users can update own json parser history" ON json_parser_history')
    console.log('  FOR UPDATE USING (auth.uid() = user_id);')
    console.log('')
    console.log('CREATE POLICY "Users can delete own json parser history" ON json_parser_history')
    console.log('  FOR DELETE USING (auth.uid() = user_id);')
    console.log('')
    
    return true

  } catch (error) {
    console.error('Error in createJSONParserHistoryTable:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Starting JSON Parser History table creation...')
  
  const success = await createJSONParserHistoryTable()
  
  if (success) {
    console.log('✅ JSON Parser History table creation completed successfully!')
  } else {
    console.log('❌ JSON Parser History table creation failed!')
    process.exit(1)
  }
}

main().catch(console.error)