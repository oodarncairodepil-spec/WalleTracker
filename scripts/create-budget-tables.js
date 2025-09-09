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

async function createBudgetTables() {
  try {
    console.log('Creating budget tables...');
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-budget-tables.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('\nIMPORTANT: You need to manually execute the SQL schema in your Supabase dashboard.');
    console.log('\nSteps to set up the budget tables:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the contents of scripts/create-budget-tables.sql');
    console.log('4. Execute the SQL statements');
    
    console.log('\nAlternatively, you can use the Supabase CLI:');
    console.log('1. Install Supabase CLI: npm install -g supabase');
    console.log('2. Login: supabase login');
    console.log('3. Link project: supabase link --project-ref YOUR_PROJECT_REF');
    console.log('4. Run migration: supabase db push');
    
    console.log('\nFor now, let me test if the budget tables already exist...');
    
    // Test if budget tables exist
    const { data: budgetData, error: budgetError } = await supabase
      .from('budgets')
      .select('count', { count: 'exact' })
      .limit(1);
    
    if (budgetError) {
      console.error('\n❌ Budget tables do not exist yet. Please follow the steps above to create them.');
      console.error('Error:', budgetError.message);
      
      console.log('\n📋 SQL Content to execute:');
      console.log('=' .repeat(50));
      console.log(sqlContent);
      console.log('=' .repeat(50));
    } else {
      console.log('\n✅ Budget tables already exist!');
      
      // Test budget_history table as well
      const { data: historyData, error: historyError } = await supabase
        .from('budget_history')
        .select('count', { count: 'exact' })
        .limit(1);
      
      if (historyError) {
        console.log('❌ Budget history table does not exist');
      } else {
        console.log('✅ Budget history table exists');
      }
      
      console.log('\n🎉 Budget system is ready to use!');
    }
    
  } catch (error) {
    console.error('Setup failed:', error);
    console.log('\nPlease manually execute the SQL in your Supabase dashboard:');
    console.log('1. Go to your Supabase project dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy and paste the contents of scripts/create-budget-tables.sql');
    console.log('4. Execute the SQL statements');
  }
}

createBudgetTables();