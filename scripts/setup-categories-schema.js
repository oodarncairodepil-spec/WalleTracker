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

async function createCategoriesTable() {
  try {
    console.log('Creating categories table and updating transactions table...');
    
    // Since we can't execute DDL with the anon key, let's just test if we can access the tables
    // and provide instructions for manual setup
    
    console.log('\n📋 Manual Setup Required:');
    console.log('Please go to your Supabase project dashboard and execute the following SQL:');
    console.log('\n1. Go to https://supabase.com/dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of supabase-schema-categories.sql');
    console.log('4. Execute the SQL statements');
    
    // Test current table structure
    console.log('\nTesting current database structure...');
    
    try {
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .limit(1);
      
      if (!transactionsError) {
        console.log('✅ Transactions table exists');
        console.log('Sample transaction structure:', Object.keys(transactions[0] || {}));
      } else {
        console.log('❌ Transactions table error:', transactionsError.message);
      }
    } catch (err) {
      console.log('❌ Transactions table does not exist:', err.message);
    }
    
    try {
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .limit(1);
      
      if (!categoriesError) {
        console.log('✅ Categories table exists and is accessible!');
        console.log('Categories count:', categories.length);
        return true;
      } else {
        console.log('❌ Categories table not accessible:', categoriesError.message);
        return false;
      }
    } catch (err) {
      console.log('❌ Categories table does not exist:', err.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    return false;
  }
}

createCategoriesTable();