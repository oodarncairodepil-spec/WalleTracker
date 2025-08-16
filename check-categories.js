const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCategories() {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, type, parent_id')
      .order('name');
    
    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }
    
    console.log('\n=== ALL CATEGORIES ===');
    console.log(`Total categories: ${data.length}`);
    
    if (data.length === 0) {
      console.log('No categories found in database');
      return;
    }
    
    // Group by main categories and subcategories
    const mainCategories = data.filter(cat => !cat.parent_id);
    const subCategories = data.filter(cat => cat.parent_id);
    
    console.log('\n=== MAIN CATEGORIES ===');
    mainCategories.forEach(cat => {
      console.log(`- ${cat.name} (${cat.type}) [ID: ${cat.id}]`);
    });
    
    console.log('\n=== SUB-CATEGORIES ===');
    subCategories.forEach(cat => {
      const parent = mainCategories.find(p => p.id === cat.parent_id);
      const parentName = parent ? parent.name : 'Unknown Parent';
      console.log(`- ${cat.name} (${cat.type}) [Parent: ${parentName}] [ID: ${cat.id}]`);
    });
    
    // Check for Transport-related categories specifically
    const transportCategories = data.filter(cat => 
      cat.name.toLowerCase().includes('transport') || 
      cat.name.toLowerCase().includes('ka bandara') ||
      cat.name.toLowerCase().includes('krl')
    );
    
    console.log('\n=== TRANSPORT-RELATED CATEGORIES ===');
    if (transportCategories.length === 0) {
      console.log('No transport-related categories found');
    } else {
      transportCategories.forEach(cat => {
        const isSubCategory = cat.parent_id ? true : false;
        const parentInfo = isSubCategory ? 
          ` [Parent ID: ${cat.parent_id}]` : 
          ' [Main Category]';
        console.log(`- ${cat.name} (${cat.type})${parentInfo} [ID: ${cat.id}]`);
      });
    }
    
    // Check for duplicate names
    const nameGroups = {};
    data.forEach(cat => {
      const key = `${cat.name}_${cat.type}`;
      if (!nameGroups[key]) nameGroups[key] = [];
      nameGroups[key].push(cat);
    });
    
    const duplicates = Object.entries(nameGroups).filter(([key, cats]) => cats.length > 1);
    
    console.log('\n=== DUPLICATE CATEGORY NAMES ===');
    if (duplicates.length === 0) {
      console.log('No duplicate category names found');
    } else {
      duplicates.forEach(([key, cats]) => {
        const [name, type] = key.split('_');
        console.log(`\nDuplicate: "${name}" (${type})`);
        cats.forEach(cat => {
          const categoryType = cat.parent_id ? 'Sub-category' : 'Main category';
          console.log(`  - ${categoryType} [ID: ${cat.id}]${cat.parent_id ? ` [Parent: ${cat.parent_id}]` : ''}`);
        });
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCategories();