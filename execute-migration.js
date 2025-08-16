const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing environment variables:');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('\nYou can find these in your Supabase project dashboard:');
  console.error('1. Go to https://supabase.com/dashboard');
  console.error('2. Select your project');
  console.error('3. Go to Settings > API');
  console.error('4. Copy the Project URL and anon/public key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function executeMigration() {
  try {
    console.log('🚀 Starting database migration to separate tables...');
    console.log('⚠️  IMPORTANT: This will modify your database structure!');
    console.log('\n📋 Migration steps:');
    console.log('1. Create backup of existing categories table');
    console.log('2. Create new main_categories and subcategories tables');
    console.log('3. Migrate existing data to new structure');
    console.log('4. Update transactions table references');
    console.log('5. Create indexes and verification queries');
    
    // Read the schema file first
    const schemaPath = path.join(__dirname, 'separate-tables-schema.sql');
    const migrationPath = path.join(__dirname, 'migrate-to-separate-tables.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Schema file not found:', schemaPath);
      process.exit(1);
    }
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Migration file not found:', migrationPath);
      process.exit(1);
    }
    
    console.log('\n📖 Reading SQL files...');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute schema creation first
    console.log('\n🏗️  Creating new table schema...');
    const { error: schemaError } = await supabase.rpc('exec_sql', { sql: schemaSQL });
    
    if (schemaError) {
      console.error('❌ Schema creation failed:', schemaError.message);
      console.log('\n💡 Note: You may need to execute the SQL manually in Supabase dashboard:');
      console.log('1. Go to your Supabase project dashboard');
      console.log('2. Navigate to SQL Editor');
      console.log('3. Copy and paste the contents of separate-tables-schema.sql');
      console.log('4. Execute the SQL statements');
      console.log('5. Then copy and paste the contents of migrate-to-separate-tables.sql');
      console.log('6. Execute the migration SQL statements');
      return;
    }
    
    console.log('✅ Schema created successfully!');
    
    // Execute migration
    console.log('\n🔄 Executing data migration...');
    const { error: migrationError } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (migrationError) {
      console.error('❌ Migration failed:', migrationError.message);
      console.log('\n💡 You may need to execute the migration SQL manually in Supabase dashboard.');
      return;
    }
    
    console.log('✅ Migration completed successfully!');
    
    // Verify migration results
    console.log('\n🔍 Verifying migration results...');
    
    // Check main categories
    const { data: mainCategories, error: mainError } = await supabase
      .from('main_categories')
      .select('count', { count: 'exact' });
    
    if (!mainError) {
      console.log(`✅ Main categories table: ${mainCategories?.length || 0} records`);
    }
    
    // Check subcategories
    const { data: subcategories, error: subError } = await supabase
      .from('subcategories')
      .select('count', { count: 'exact' });
    
    if (!subError) {
      console.log(`✅ Subcategories table: ${subcategories?.length || 0} records`);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Update your application to use the new CategoriesPageV2 component');
    console.log('2. Test the new category management functionality');
    console.log('3. Verify that transactions are properly linked to the new structure');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n💡 Manual migration steps:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Execute separate-tables-schema.sql first');
    console.log('4. Then execute migrate-to-separate-tables.sql');
    process.exit(1);
  }
}

executeMigration();