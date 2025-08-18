require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndDropTables() {
  try {
    console.log('Checking existing tables...');
    
    // Check if categories table exists
    console.log('Checking categories table...');
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .limit(1);
    
    if (categoriesError) {
      console.log('categories table does not exist or is not accessible:', categoriesError.message);
    } else {
      console.log('categories table exists with columns:', Object.keys(categoriesData[0] || {}));
    }

    // Check if categories_with_hierarchy table exists
    console.log('Checking categories_with_hierarchy table...');
    const { data: hierarchyData, error: hierarchyError } = await supabase
      .from('categories_with_hierarchy')
      .select('*')
      .limit(1);
    
    if (hierarchyError) {
      console.log('categories_with_hierarchy table does not exist or is not accessible:', hierarchyError.message);
    } else {
      console.log('categories_with_hierarchy table exists with columns:', Object.keys(hierarchyData[0] || {}));
    }

    console.log('\nNote: Based on the user request, these tables should be dropped:');
    console.log('1. categories table (if it exists)');
    console.log('2. categories_with_hierarchy table (if it exists)');
    console.log('\nTo drop these tables, execute the following SQL commands in Supabase dashboard:');
    console.log('DROP TABLE IF EXISTS categories CASCADE;');
    console.log('DROP TABLE IF EXISTS categories_with_hierarchy CASCADE;');
    console.log('\nNote: CASCADE will also drop any dependent objects like views or foreign keys.');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkAndDropTables();