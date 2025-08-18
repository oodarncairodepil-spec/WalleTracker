require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategoryMapping() {
  try {
    console.log('Checking category mappings...');
    
    // Get transactions with 'Internal Transfer' in description
    const { data: internalTransfers, error: transferError } = await supabase
      .from('transactions')
      .select('*')
      .ilike('description', '%Internal Transfer%');
    
    if (transferError) {
      console.error('Error searching for internal transfers:', transferError.message);
    } else {
      console.log('\nTransactions with "Internal Transfer" in description:', internalTransfers?.length || 0);
      if (internalTransfers && internalTransfers.length > 0) {
        const categoryIds = [...new Set(internalTransfers.map(t => t.category))];
        console.log('\nUnique category IDs used:', categoryIds);
        
        // Look up these category IDs in subcategories
        for (const categoryId of categoryIds) {
          if (categoryId) {
            const { data: subcat, error: subcatError } = await supabase
              .from('subcategories')
              .select('*')
              .eq('id', categoryId)
              .single();
            
            if (!subcatError && subcat) {
              console.log(`Category ID ${categoryId} -> ${subcat.name}`);
            } else {
              console.log(`Category ID ${categoryId} -> Not found in subcategories`);
            }
          }
        }
      }
    }
    
    // Get all subcategories with 'Internal' in name
    const { data: internalSubcats, error: subcatError } = await supabase
      .from('subcategories')
      .select('*')
      .ilike('name', '%Internal%');
    
    if (subcatError) {
      console.log('Error checking subcategories:', subcatError.message);
    } else {
      console.log('\nAll subcategories with "Internal" in name:');
      internalSubcats?.forEach(cat => {
        console.log(`- ID: ${cat.id}, Name: ${cat.name}, Main Category ID: ${cat.main_category_id}`);
      });
      
      // Get main category names for these subcategories
      if (internalSubcats && internalSubcats.length > 0) {
        const mainCategoryIds = [...new Set(internalSubcats.map(s => s.main_category_id))];
        for (const mainCatId of mainCategoryIds) {
          const { data: mainCat, error: mainError } = await supabase
            .from('main_categories')
            .select('*')
            .eq('id', mainCatId)
            .single();
          
          if (!mainError && mainCat) {
            console.log(`Main Category ID ${mainCatId} -> ${mainCat.name} (${mainCat.type})`);
          }
        }
      }
    }
    
    // Check for transactions that use internal transfer subcategory IDs
    if (internalSubcats && internalSubcats.length > 0) {
      for (const subcat of internalSubcats) {
        const { data: transactions, error: transError } = await supabase
          .from('transactions')
          .select('id, description, category, type, amount')
          .eq('category', subcat.id);
        
        if (!transError && transactions && transactions.length > 0) {
          console.log(`\nTransactions using subcategory "${subcat.name}" (${subcat.id}):`);
          transactions.forEach(t => {
            console.log(`- ${t.description} | Type: ${t.type} | Amount: ${t.amount}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkCategoryMapping();