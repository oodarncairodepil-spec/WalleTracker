require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInternalTransfers() {
  try {
    console.log('Checking for internal transfer transactions...');
    
    // Get all transactions to see category patterns
    const { data: allTransactions, error: allError } = await supabase
      .from('transactions')
      .select('id, description, category, type, amount')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (allError) {
      console.error('Error fetching transactions:', allError.message);
    } else {
      console.log('\nSample transactions:');
      allTransactions?.forEach(t => {
        console.log(`- ${t.description} | Category: ${t.category} | Type: ${t.type} | Amount: ${t.amount}`);
      });
    }
    
    // Look for transactions with 'Internal Transfer' in category
    const { data: internalTransfers, error: transferError } = await supabase
      .from('transactions')
      .select('*')
      .ilike('category', '%Internal Transfer%');
    
    if (transferError) {
      console.error('Error searching for internal transfers:', transferError.message);
    } else {
      console.log('\nInternal Transfer transactions found:', internalTransfers?.length || 0);
      if (internalTransfers && internalTransfers.length > 0) {
        internalTransfers.forEach(t => {
          console.log(`- ${t.description} | Category: ${t.category} | Type: ${t.type} | Amount: ${t.amount}`);
        });
      }
    }
    
    // Check main_categories and subcategories for internal transfer categories
    const { data: mainCats, error: mainError } = await supabase
      .from('main_categories')
      .select('*')
      .ilike('name', '%Internal%');
    
    if (mainError) {
      console.log('Error checking main categories:', mainError.message);
    } else {
      console.log('\nMain categories with "Internal":');
      mainCats?.forEach(cat => {
        console.log(`- ${cat.name} (${cat.type})`);
      });
    }
    
    const { data: subCats, error: subError } = await supabase
      .from('subcategories')
      .select('*')
      .ilike('name', '%Internal%');
    
    if (subError) {
      console.log('Error checking subcategories:', subError.message);
    } else {
      console.log('\nSubcategories with "Internal":');
      subCats?.forEach(cat => {
        console.log(`- ${cat.name}`);
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkInternalTransfers();