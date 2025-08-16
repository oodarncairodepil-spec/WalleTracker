import { supabase } from '@/lib/supabase'

// New interfaces for separate tables
export interface MainCategory {
  id: string
  user_id: string
  name: string
  type: 'income' | 'expense'
  emoji?: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface Subcategory {
  id: string
  user_id: string
  main_category_id: string
  name: string
  emoji?: string
  budget_amount: number
  budget_period: 'monthly' | 'weekly' | 'yearly'
  is_active: boolean
  created_at?: string
  updated_at?: string
}

// Combined interface for display purposes
export interface CategoryWithSubcategories extends MainCategory {
  subcategories: Subcategory[]
}

// Flattened interface for lists (similar to old Category interface)
export interface CategoryItem {
  id: string
  user_id: string
  name: string
  type: 'income' | 'expense'
  emoji?: string
  budget_amount?: number
  budget_period?: 'monthly' | 'weekly' | 'yearly'
  is_active: boolean
  full_path: string // e.g., "Transportation > KA Bandara" or just "Transportation"
  item_type: 'main_category' | 'subcategory'
  main_category_id?: string // Only for subcategories
  main_category_name?: string // Only for subcategories
  created_at?: string
  updated_at?: string
}

export const categoriesServiceV2 = {
  // Get all main categories for a user
  async getMainCategories(userId: string, type?: 'income' | 'expense'): Promise<{ data: MainCategory[] | null; error: Error | null }> {
    try {
      let query = supabase
        .from('main_categories')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name', { ascending: true })
      
      if (type) {
        query = query.eq('type', type)
      }
      
      const { data, error } = await query
      return { data, error }
    } catch (error) {
      console.error('Error fetching main categories:', error)
      return { data: null, error: error as Error }
    }
  },

  // Get subcategories for a specific main category
  async getSubcategories(mainCategoryId: string): Promise<{ data: Subcategory[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('main_category_id', mainCategoryId)
        .eq('is_active', true)
        .order('name', { ascending: true })
      
      return { data, error }
    } catch (error) {
      console.error('Error fetching subcategories:', error)
      return { data: null, error: error as Error }
    }
  },

  // Get all subcategories for a user
  async getAllSubcategories(userId: string): Promise<{ data: Subcategory[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name', { ascending: true })
      
      return { data, error }
    } catch (error) {
      console.error('Error fetching all subcategories:', error)
      return { data: null, error: error as Error }
    }
  },

  // Get main categories with their subcategories
  async getCategoriesWithSubcategories(userId: string, type?: 'income' | 'expense'): Promise<{ data: CategoryWithSubcategories[] | null; error: Error | null }> {
    try {
      // Get main categories
      const { data: mainCategories, error: mainError } = await this.getMainCategories(userId, type)
      if (mainError) return { data: null, error: mainError }
      
      if (!mainCategories || mainCategories.length === 0) {
        return { data: [], error: null }
      }
      
      // Get all subcategories for this user
      const { data: allSubcategories, error: subError } = await this.getAllSubcategories(userId)
      if (subError) return { data: null, error: subError }
      
      // Group subcategories by main category
      const result: CategoryWithSubcategories[] = mainCategories.map(mainCat => ({
        ...mainCat,
        subcategories: (allSubcategories || []).filter(sub => sub.main_category_id === mainCat.id)
      }))
      
      return { data: result, error: null }
    } catch (error) {
      console.error('Error fetching categories with subcategories:', error)
      return { data: null, error: error as Error }
    }
  },

  // Get flattened list of all categories and subcategories (for compatibility with old UI)
  async getAllCategoriesFlattened(userId: string, type?: 'income' | 'expense'): Promise<{ data: CategoryItem[] | null; error: Error | null }> {
    try {
      let query = supabase
        .from('categories_with_subcategories')
        .select('*')
        .eq('user_id', userId)
      
      if (type) {
        query = query.eq('category_type', type)
      }
      
      const { data, error } = await query
      
      if (error) return { data: null, error }
      
      // Transform the view data to CategoryItem format
      const result: CategoryItem[] = (data || []).map(item => ({
        id: item.subcategory_id || item.main_category_id,
        user_id: item.user_id,
        name: item.subcategory_name || item.main_category_name,
        type: item.category_type,
        emoji: item.subcategory_emoji || item.main_category_emoji,
        budget_amount: item.budget_amount || 0,
        budget_period: item.budget_period || 'monthly',
        is_active: true,
        full_path: item.full_path,
        item_type: item.item_type,
        main_category_id: item.subcategory_id ? item.main_category_id : undefined,
        main_category_name: item.subcategory_id ? item.main_category_name : undefined
      }))
      
      return { data: result, error: null }
    } catch (error) {
      console.error('Error fetching flattened categories:', error)
      return { data: null, error: error as Error }
    }
  },

  // Add a new main category
  async addMainCategory(category: Omit<MainCategory, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: MainCategory | null; error: Error | null }> {
    try {
      // Check for existing main category with same name and type
      const { data: existingCategory, error: checkError } = await supabase
        .from('main_categories')
        .select('id')
        .eq('user_id', category.user_id)
        .eq('name', category.name)
        .eq('type', category.type)
        .single()
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        return { data: null, error: checkError }
      }
      
      if (existingCategory) {
        return { 
          data: null, 
          error: new Error(`Main category "${category.name}" already exists`)
        }
      }
      
      const { data, error } = await supabase
        .from('main_categories')
        .insert([category])
        .select()
        .single()
      
      return { data, error }
    } catch (error) {
      console.error('Error adding main category:', error)
      return { data: null, error: error as Error }
    }
  },

  // Add a new subcategory
  async addSubcategory(subcategory: Omit<Subcategory, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Subcategory | null; error: Error | null }> {
    try {
      // Check for existing subcategory with same name under the same main category
      const { data: existingSubcategory, error: checkError } = await supabase
        .from('subcategories')
        .select('id')
        .eq('user_id', subcategory.user_id)
        .eq('main_category_id', subcategory.main_category_id)
        .eq('name', subcategory.name)
        .single()
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        return { data: null, error: checkError }
      }
      
      if (existingSubcategory) {
        // Get main category name for better error message
        const { data: mainCategory } = await supabase
          .from('main_categories')
          .select('name')
          .eq('id', subcategory.main_category_id)
          .single()
        
        return { 
          data: null, 
          error: new Error(`Subcategory "${subcategory.name}" already exists under "${mainCategory?.name || 'this category'}"`)
        }
      }
      
      const { data, error } = await supabase
        .from('subcategories')
        .insert([subcategory])
        .select()
        .single()
      
      return { data, error }
    } catch (error) {
      console.error('Error adding subcategory:', error)
      return { data: null, error: error as Error }
    }
  },

  // Update a main category
  async updateMainCategory(id: string, updates: Partial<Omit<MainCategory, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<{ data: MainCategory | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('main_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      return { data, error }
    } catch (error) {
      console.error('Error updating main category:', error)
      return { data: null, error: error as Error }
    }
  },

  // Update a subcategory
  async updateSubcategory(id: string, updates: Partial<Omit<Subcategory, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<{ data: Subcategory | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      return { data, error }
    } catch (error) {
      console.error('Error updating subcategory:', error)
      return { data: null, error: error as Error }
    }
  },

  // Delete a main category (and all its subcategories due to CASCADE)
  async deleteMainCategory(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('main_categories')
        .delete()
        .eq('id', id)
      
      return { error }
    } catch (error) {
      console.error('Error deleting main category:', error)
      return { error: error as Error }
    }
  },

  // Delete a subcategory
  async deleteSubcategory(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('subcategories')
        .delete()
        .eq('id', id)
      
      return { error }
    } catch (error) {
      console.error('Error deleting subcategory:', error)
      return { error: error as Error }
    }
  },

  // Create default categories for a new user
  async createDefaultCategories(userId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase.rpc('create_default_categories_for_user', {
        user_uuid: userId
      })
      
      return { error }
    } catch (error) {
      console.error('Error creating default categories:', error)
      return { error: error as Error }
    }
  },

  // Get budget summary (sum of all subcategory budgets by type)
  async getBudgetSummary(userId: string): Promise<{ data: { type: string; total_budget: number }[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select(`
          budget_amount,
          main_categories!inner(type)
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
      
      if (error) return { data: null, error }
      
      // Group by type and sum budgets
      const summary = (data || []).reduce((acc: { type: string; total_budget: number }[], item: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        const type = item.main_categories.type
        const existing = acc.find(s => s.type === type)
        
        if (existing) {
          existing.total_budget += item.budget_amount
        } else {
          acc.push({ type, total_budget: item.budget_amount })
        }
        
        return acc
      }, [] as { type: string; total_budget: number }[])
      
      return { data: summary, error: null }
    } catch (error) {
      console.error('Error getting budget summary:', error)
      return { data: null, error: error as Error }
    }
  }
}