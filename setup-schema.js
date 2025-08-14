const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('Supabase URL:', supabaseUrl);
    console.log('Using anon key:', supabaseAnonKey.substring(0, 20) + '...');
    
    // Test basic connection
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Connection test failed:', error.message);
      return false;
    }
    
    console.log('✅ Supabase connection successful!');
    
    // Test if tables exist
    console.log('\nChecking if database tables exist...');
    
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('count', { count: 'exact' })
        .limit(1);
      
      if (!profilesError) {
        console.log('✅ Profiles table exists');
      } else {
        console.log('❌ Profiles table does not exist:', profilesError.message);
      }
    } catch (err) {
      console.log('❌ Profiles table does not exist:', err.message);
    }
    
    try {
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('count', { count: 'exact' })
        .limit(1);
      
      if (!transactionsError) {
        console.log('✅ Transactions table exists');
      } else {
        console.log('❌ Transactions table does not exist:', transactionsError.message);
      }
    } catch (err) {
      console.log('❌ Transactions table does not exist:', err.message);
    }
    
    console.log('\n📋 To set up the database tables:');
    console.log('1. Go to your Supabase project dashboard: https://supabase.com/dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the contents of supabase-schema.sql');
    console.log('4. Execute the SQL statements');
    console.log('\nAlternatively, if you have service role key:');
    console.log('1. Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file');
    console.log('2. Run the setup script with service role permissions');
    
    return true;
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    return false;
  }
}

testConnection();