require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migrateBudgets() {
  try {
    console.log('Starting budget migration from subcategories to budgets table...')
    
    // Get all subcategories with budget amounts > 0
    const { data: subcategories, error: subcategoriesError } = await supabase
      .from('subcategories')
      .select(`
        id,
        name,
        user_id,
        main_category_id,
        budget_amount,
        budget_period,
        budget_period_custom,
        main_categories!inner(type)
      `)
      .gt('budget_amount', 0)
    
    if (subcategoriesError) {
      throw subcategoriesError
    }
    
    console.log(`Found ${subcategories?.length || 0} subcategories with budgets to migrate`)
    
    if (!subcategories || subcategories.length === 0) {
      console.log('No budgets to migrate')
      return
    }
    
    // Get current date for period calculation
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-based
    
    // Calculate period dates based on budget_period
    function getPeriodDates(budgetPeriod, budgetPeriodCustom) {
      const today = new Date()
      
      switch (budgetPeriod) {
        case 'weekly':
          // Start of current week (Monday)
          const startOfWeek = new Date(today)
          const dayOfWeek = startOfWeek.getDay()
          const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
          startOfWeek.setDate(startOfWeek.getDate() - daysToMonday)
          startOfWeek.setHours(0, 0, 0, 0)
          
          const endOfWeek = new Date(startOfWeek)
          endOfWeek.setDate(endOfWeek.getDate() + 6)
          endOfWeek.setHours(23, 59, 59, 999)
          
          return {
            start: startOfWeek.toISOString().split('T')[0],
            end: endOfWeek.toISOString().split('T')[0]
          }
          
        case 'yearly':
          return {
            start: `${currentYear}-01-01`,
            end: `${currentYear}-12-31`
          }
          
        case 'custom':
          if (budgetPeriodCustom) {
            // Assume custom format is "YYYY-MM-DD to YYYY-MM-DD"
            const parts = budgetPeriodCustom.split(' to ')
            if (parts.length === 2) {
              return {
                start: parts[0],
                end: parts[1]
              }
            }
          }
          // Fallback to monthly if custom format is invalid
          return {
            start: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
            end: new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]
          }
          
        case 'monthly':
        default:
          return {
            start: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
            end: new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0]
          }
      }
    }
    
    // Prepare budget records for insertion
    const budgetRecords = subcategories.map(subcategory => {
      const periodDates = getPeriodDates(subcategory.budget_period, subcategory.budget_period_custom)
      
      return {
        user_id: subcategory.user_id,
        period_start_date: periodDates.start,
        period_end_date: periodDates.end,
        period_type: subcategory.budget_period || 'monthly',
        subcategory_id: subcategory.id,
        category_name: subcategory.name,
        category_type: subcategory.main_categories.type,
        budgeted_amount: subcategory.budget_amount
      }
    })
    
    console.log('Sample budget record:', budgetRecords[0])
    
    // Insert budget records in batches
    const batchSize = 100
    let insertedCount = 0
    let skippedCount = 0
    
    for (let i = 0; i < budgetRecords.length; i += batchSize) {
      const batch = budgetRecords.slice(i, i + batchSize)
      
      try {
        const { data, error } = await supabase
          .from('budgets')
          .insert(batch)
          .select('id')
        
        if (error) {
          // Check if it's a unique constraint violation (budget already exists)
          if (error.code === '23505') {
            console.log(`Batch ${Math.floor(i / batchSize) + 1}: Some budgets already exist, skipping duplicates`)
            skippedCount += batch.length
          } else {
            throw error
          }
        } else {
          insertedCount += data?.length || 0
          console.log(`Batch ${Math.floor(i / batchSize) + 1}: Inserted ${data?.length || 0} budget records`)
        }
      } catch (batchError) {
        console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, batchError)
        // Continue with next batch
      }
    }
    
    console.log(`\n✅ Migration completed!`)
    console.log(`📊 Summary:`)
    console.log(`   - Total subcategories with budgets: ${subcategories.length}`)
    console.log(`   - Successfully migrated: ${insertedCount}`)
    console.log(`   - Skipped (already exist): ${skippedCount}`)
    console.log(`   - Failed: ${subcategories.length - insertedCount - skippedCount}`)
    
    console.log(`\n⚠️  Note: Original budget data in subcategories table is preserved.`)
    console.log(`   You can remove budget_amount, budget_period, and budget_period_custom`)
    console.log(`   columns from subcategories table once you've verified the migration.`)
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
migrateBudgets()
  .then(() => {
    console.log('\n🎉 Budget migration script completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Migration script failed:', error)
    process.exit(1)
  })