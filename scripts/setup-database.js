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

async function setupDatabase() {
  try {
    console.log('Setting up database schema...');
    console.log('\nIMPORTANT: You need to manually execute the SQL schema in your Supabase dashboard.');
    console.log('\nSteps to set up the database:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the contents of supabase-schema.sql');
    console.log('4. Execute the SQL statements');
    console.log('\nAlternatively, you can use the Supabase CLI:');
    console.log('1. Install Supabase CLI: npm install -g supabase');
    console.log('2. Login: supabase login');
    console.log('3. Link project: supabase link --project-ref YOUR_PROJECT_REF');
    console.log('4. Run migration: supabase db push');
    
    console.log('\nFor now, let me test if the tables already exist...');
    
    // Test the connection
    const { data, error } = await supabase.from('profiles').select('count', { count: 'exact' });
    
    if (error) {
      console.error('\nTables do not exist yet. Please follow the steps above to create them.');
      console.error('Error:', error.message);
    } else {
      console.log('\nDatabase connection test successful! Tables are already set up.');
    }
    
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();