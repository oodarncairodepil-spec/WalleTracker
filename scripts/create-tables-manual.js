const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zymtsomxypfslblksxdv.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5bXRzb214eXBmc2xibGtzeGR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTE0ODYxNiwiZXhwIjoyMDcwNzI0NjE2fQ.4IHdATHm4Uf2vhGh179v62FeXnQiGPIewKKKhVvzmn0';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function createTables() {
  try {
    console.log('🚀 Creating database tables manually...');
    
    // Create main_categories table
    console.log('📋 Creating main_categories table...');
    const { error: mainCategoriesError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.main_categories (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
          name TEXT NOT NULL,
          type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
          emoji TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, name)
        );
        
        ALTER TABLE public.main_categories ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view their own main categories" ON public.main_categories
          FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert their own main categories" ON public.main_categories
          FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update their own main categories" ON public.main_categories
          FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can delete their own main categories" ON public.main_categories
          FOR DELETE USING (auth.uid() = user_id);
      `
    });
    
    if (mainCategoriesError) {
      console.error('❌ Error creating main_categories:', mainCategoriesError.message);
    } else {
      console.log('✅ main_categories table created successfully');
    }
    
    // Create subcategories table
    console.log('📋 Creating subcategories table...');
    const { error: subcategoriesError } = await supabase.rpc('exec', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.subcategories (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
          main_category_id UUID REFERENCES public.main_categories(id) ON DELETE CASCADE NOT NULL,
          name TEXT NOT NULL,
          emoji TEXT,
          budget_amount BIGINT DEFAULT 0,
          budget_period TEXT CHECK (budget_period IN ('weekly', 'monthly', 'yearly')) DEFAULT 'monthly',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, main_category_id, name)
        );
        
        ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view their own subcategories" ON public.subcategories
          FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert their own subcategories" ON public.subcategories
          FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        CREATE POLICY "Users can update their own subcategories" ON public.subcategories
          FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can delete their own subcategories" ON public.subcategories
          FOR DELETE USING (auth.uid() = user_id);
      `
    });
    
    if (subcategoriesError) {
      console.error('❌ Error creating subcategories:', subcategoriesError.message);
    } else {
      console.log('✅ subcategories table created successfully');
    }
    
    // Create indexes
    console.log('📋 Creating indexes...');
    const { error: indexError } = await supabase.rpc('exec', {
      sql: `
        CREATE INDEX IF NOT EXISTS idx_main_categories_user_id ON public.main_categories(user_id);
        CREATE INDEX IF NOT EXISTS idx_main_categories_type ON public.main_categories(type);
        CREATE INDEX IF NOT EXISTS idx_subcategories_user_id ON public.subcategories(user_id);
        CREATE INDEX IF NOT EXISTS idx_subcategories_main_category_id ON public.subcategories(main_category_id);
      `
    });
    
    if (indexError) {
      console.error('❌ Error creating indexes:', indexError.message);
    } else {
      console.log('✅ Indexes created successfully');
    }
    
    console.log('\n🎉 Database tables created successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Test the categories functionality');
    console.log('2. Migrate existing data if needed');
    
  } catch (error) {
    console.error('❌ Failed to create tables:', error.message);
    process.exit(1);
  }
}

createTables();