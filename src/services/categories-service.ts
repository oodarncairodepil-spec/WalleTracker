import { supabase } from '../lib/supabase'
import type { Category } from '../lib/supabase'

export const categoriesService = {
  // Get all categories for a user
  async getCategories(userId: string): Promise<{ data: Category[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('type', { ascending: true })
        .order('name', { ascending: true })
      
      return { data, error }
    } catch (error) {
      console.error('Error fetching categories:', error)
      return { data: null, error: error as Error }
    }
  },

  // Get categories by type
  async getCategoriesByType(userId: string, type: 'income' | 'expense'): Promise<{ data: Category[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('is_active', true)
        .order('name', { ascending: true })
      
      return { data, error }
    } catch (error) {
      console.error('Error fetching categories by type:', error)
      return { data: null, error: error as Error }
    }
  },

  // Add a new category or sub-category
  async addCategory(category: Omit<Category, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Category | null; error: Error | null }> {
    try {
      // Check for existing category with same name, type, user_id, and parent_id
      let query = supabase
        .from('categories')
        .select('id')
        .eq('user_id', category.user_id)
        .eq('name', category.name)
        .eq('type', category.type)
      
      // Add parent_id condition based on whether it's a main category or sub-category
      if (category.parent_id) {
        query = query.eq('parent_id', category.parent_id)
      } else {
        query = query.is('parent_id', null)
      }
      
      const { data: existingCategory, error: checkError } = await query.single()
      
      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('Error checking for existing category:', checkError)
        return { data: null, error: checkError }
      }
      
      if (existingCategory) {
        return {
          data: null,
          error: new Error(category.parent_id 
            ? `Sub-category "${category.name}" already exists under this parent category`
            : `Category "${category.name}" already exists`)
        }
      }
      
      // Create category (main or sub-category based on presence of parent_id)
      const { data, error } = await supabase
        .from('categories')
        .insert([category])
        .select()
        .single()
      
      return { data, error }
    } catch (error) {
      console.error('Error adding category:', error)
      return { data: null, error: error as Error }
    }
  },

  // Update a category
  async updateCategory(id: string, updates: Partial<Omit<Category, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<{ data: Category | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      return { data, error }
    } catch (error) {
      console.error('Error updating category:', error)
      return { data: null, error: error as Error }
    }
  },

  // Delete a category (soft delete by setting is_active to false)
  async deleteCategory(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: false })
        .eq('id', id)
      
      return { error }
    } catch (error) {
      console.error('Error deleting category:', error)
      return { error: error as Error }
    }
  },

  // Hard delete a category (permanently remove)
  async hardDeleteCategory(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
      
      return { error }
    } catch (error) {
      console.error('Error hard deleting category:', error)
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

  // Get categories with hierarchy (parent-child relationships)
  async getCategoriesWithHierarchy(userId: string): Promise<{ data: Category[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('categories_with_hierarchy')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('category_type', { ascending: true })
        .order('name', { ascending: true })
      
      return { data, error }
    } catch (error) {
      console.error('Error fetching categories with hierarchy:', error)
      return { data: null, error: error as Error }
    }
  },

  // Get sub-categories for a parent category
  async getSubCategories(parentId: string): Promise<{ data: Category[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('parent_id', parentId)
        .eq('is_active', true)
        .order('name', { ascending: true })
      
      return { data, error }
    } catch (error) {
      console.error('Error fetching sub-categories:', error)
      return { data: null, error: error as Error }
    }
  },

  // Get budget summary for categories
  async getBudgetSummary(userId: string, period: 'monthly' | 'weekly' | '10days' = 'monthly'): Promise<{ data: Array<{type: string, total_budget: number}> | null; error: Error | null }> {
    try {
      // Get categories with their budget amounts
      const { data: categories, error: categoriesError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .eq('budget_period', period)
        .eq('is_active', true)
      
      if (categoriesError) {
        return { data: null, error: categoriesError }
      }

      // Calculate date range based on period
      const now = new Date()
      let startDate: Date
      
      switch (period) {
        case 'weekly':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
          break
        case '10days':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 9)
          break
        default: // monthly
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      }

      // Get spending for each category in the current period
      const budgetSummary = await Promise.all(
        categories?.map(async (category) => {
          const { data: transactions, error: transError } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', userId)
            .eq('category_id', category.id)
            .eq('type', 'expense')
            .gte('date', startDate.toISOString())
            .lte('date', now.toISOString())
          
          if (transError) {
            console.error('Error fetching transactions for category:', transError)
            return {
              ...category,
              spent: 0,
              remaining: category.budget_amount,
              percentage: 0
            }
          }

          const spent = transactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0
          const remaining = category.budget_amount - spent
          const percentage = category.budget_amount > 0 ? (spent / category.budget_amount) * 100 : 0

          return {
            ...category,
            spent,
            remaining,
            percentage: Math.min(percentage, 100)
          }
        }) || []
      )
      
      return { data: budgetSummary, error: null }
    } catch (error) {
      console.error('Error fetching budget summary:', error)
      return { data: null, error: error as Error }
    }
  }
}