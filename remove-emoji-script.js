require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function removeEmojiColumns() {
  try {
    console.log('Removing emoji column from main_categories table...');
    const { data: result1, error: error1 } = await supabase
      .from('main_categories')
      .select('*')
      .limit(1);
    
    if (error1) {
      console.error('Error accessing main_categories:', error1);
    } else {
      console.log('main_categories table exists, columns:', Object.keys(result1[0] || {}));
    }

    console.log('Checking subcategories table...');
    const { data: result2, error: error2 } = await supabase
      .from('subcategories')
      .select('*')
      .limit(1);
    
    if (error2) {
      console.error('Error accessing subcategories:', error2);
    } else {
      console.log('subcategories table exists, columns:', Object.keys(result2[0] || {}));
    }

    console.log('Checking categories_with_hierarchy table...');
    const { data: result3, error: error3 } = await supabase
      .from('categories_with_hierarchy')
      .select('*')
      .limit(1);
    
    if (error3) {
      console.log('categories_with_hierarchy table does not exist or is not accessible:', error3.message);
    } else {
      console.log('categories_with_hierarchy table exists, columns:', Object.keys(result3[0] || {}));
    }

    console.log('\nNote: To remove emoji columns, you need to execute SQL commands directly in Supabase dashboard:');
    console.log('1. ALTER TABLE main_categories DROP COLUMN IF EXISTS emoji;');
    console.log('2. ALTER TABLE subcategories DROP COLUMN IF EXISTS emoji;');
    console.log('3. ALTER TABLE categories_with_hierarchy DROP COLUMN IF EXISTS emoji; (if table exists)');

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

removeEmojiColumns();