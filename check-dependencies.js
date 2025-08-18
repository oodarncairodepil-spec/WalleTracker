require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDependencies() {
  try {
    console.log('Checking dependencies and object types...');
    
    // Check if categories_with_hierarchy is a view
    const { data: viewCheck, error: viewError } = await supabase
      .rpc('exec', {
        sql: `
          SELECT table_type 
          FROM information_schema.tables 
          WHERE table_name = 'categories_with_hierarchy' 
          AND table_schema = 'public';
        `
      });
    
    if (viewError) {
      console.log('Cannot check view type via RPC, checking manually...');
      // Try to get view definition
      const { data: viewDef, error: viewDefError } = await supabase
        .rpc('exec', {
          sql: `
            SELECT view_definition 
            FROM information_schema.views 
            WHERE table_name = 'categories_with_hierarchy' 
            AND table_schema = 'public';
          `
        });
      
      if (viewDefError) {
        console.log('RPC not available, will provide manual SQL commands');
      } else {
        console.log('categories_with_hierarchy view definition:', viewDef);
      }
    } else {
      console.log('categories_with_hierarchy type:', viewCheck);
    }
    
    // Check dependencies on categories table
    const { data: deps, error: depsError } = await supabase
      .rpc('exec', {
        sql: `
          SELECT 
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM 
            information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
          WHERE 
            tc.constraint_type = 'FOREIGN KEY' 
            AND ccu.table_name = 'categories';
        `
      });
    
    if (depsError) {
      console.log('Cannot check dependencies via RPC');
      console.log('\nManual SQL commands to execute:');
      console.log('\n-- First, drop the view:');
      console.log('DROP VIEW IF EXISTS categories_with_hierarchy CASCADE;');
      console.log('\n-- Then check and drop foreign key constraints:');
      console.log('-- Check what references categories table:');
      console.log(`SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM 
  information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE 
  tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'categories';`);
      console.log('\n-- After identifying constraints, drop them and then the table:');
      console.log('-- ALTER TABLE [referencing_table] DROP CONSTRAINT [constraint_name];');
      console.log('DROP TABLE IF EXISTS categories CASCADE;');
      console.log('\n-- Remove unused columns:');
      console.log('ALTER TABLE main_categories DROP COLUMN IF EXISTS emoji;');
      console.log('ALTER TABLE subcategories DROP COLUMN IF EXISTS emoji;');
      console.log('ALTER TABLE transactions DROP COLUMN IF EXISTS category_id;');
    } else {
      console.log('Dependencies on categories table:', deps);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
    console.log('\nFallback manual commands:');
    console.log('DROP VIEW IF EXISTS categories_with_hierarchy CASCADE;');
    console.log('DROP TABLE IF EXISTS categories CASCADE;');
    console.log('ALTER TABLE main_categories DROP COLUMN IF EXISTS emoji;');
    console.log('ALTER TABLE subcategories DROP COLUMN IF EXISTS emoji;');
    console.log('ALTER TABLE transactions DROP COLUMN IF EXISTS category_id;');
  }
}

checkDependencies();