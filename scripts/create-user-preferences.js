const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createUserPreferencesTable() {
  try {
    console.log('Creating user_preferences table...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-user-preferences-table.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual statements and execute them
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 50) + '...');
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try direct query execution as fallback
          const { error: directError } = await supabase
            .from('_sql')
            .select('*')
            .eq('query', statement);
          
          if (directError) {
            console.error('Error executing statement:', error.message);
            console.error('Statement:', statement);
          }
        }
      }
    }
    
    // Test if table was created successfully
    const { data, error } = await supabase
      .from('user_preferences')
      .select('count', { count: 'exact' });
    
    if (error) {
      console.error('Table creation may have failed:', error.message);
      console.log('\nPlease manually execute the SQL in your Supabase dashboard:');
      console.log('1. Go to your Supabase project dashboard');
      console.log('2. Navigate to the SQL Editor');
      console.log('3. Copy and paste the contents of scripts/create-user-preferences-table.sql');
      console.log('4. Execute the SQL statements');
    } else {
      console.log('✅ user_preferences table created successfully!');
    }
    
  } catch (error) {
    console.error('Setup failed:', error);
    console.log('\nPlease manually execute the SQL in your Supabase dashboard:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the contents of scripts/create-user-preferences-table.sql');
    console.log('4. Execute the SQL statements');
  }
}

createUserPreferencesTable();