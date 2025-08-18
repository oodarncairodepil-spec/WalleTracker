require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTransactionTable() {
  try {
    console.log('Checking transaction table structure...');
    
    // Get a sample transaction to see the columns
    const { data: sampleTransaction, error: sampleError } = await supabase
      .from('transactions')
      .select('*')
      .limit(1);
    
    if (sampleError) {
      console.error('Error accessing transactions table:', sampleError.message);
    } else if (sampleTransaction && sampleTransaction.length > 0) {
      console.log('Transaction table columns:', Object.keys(sampleTransaction[0]));
      console.log('Sample transaction:', sampleTransaction[0]);
      
      // Check if any transactions have category_id set
      const { data: transactionsWithCategoryId, error: categoryIdError } = await supabase
        .from('transactions')
        .select('id, category_id')
        .not('category_id', 'is', null)
        .limit(5);
      
      if (categoryIdError) {
        console.error('Error checking category_id usage:', categoryIdError.message);
      } else {
        console.log('\nTransactions with category_id set:', transactionsWithCategoryId?.length || 0);
        if (transactionsWithCategoryId && transactionsWithCategoryId.length > 0) {
          console.log('Sample transactions with category_id:', transactionsWithCategoryId);
        }
      }
    } else {
      console.log('No transactions found in the table');
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkTransactionTable();