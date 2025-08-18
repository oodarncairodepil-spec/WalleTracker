import { supabase } from '../lib/supabase'
import type { Category } from '../lib/supabase'

// Fallback service that uses the original categories table
// This will work until the new main_categories and subcategories tables are created

export interface CategoryWithSubcategories {
  id: string
  name: string
  type: 'income' | 'expense'
  is_active: boolean
  subcategories: Category[]
}

export interface CategoryItem {
  id: string
  name: string
  type: 'income' | 'expense'
  is_active: boolean
  isSubcategory: boolean
  parentId?: string
  budgetAmount?: number
  budgetPeriod?: 'weekly' | 'monthly' | 'yearly'
}

export interface BudgetSummary {
  totalBudget: number
  totalSpent: number
  categories: Array<{
    id: string
    name: string
    budgetAmount: number
    spent: number
    remaining: number
    percentage: number
  }>
}

class CategoriesServiceFallback {
  async getMainCategories(userId: string): Promise<CategoryWithSubcategories[]> {
    try {
      // Get main categories from the new main_categories table
      const { data: mainCategories, error: mainError } = await supabase
        .from('main_categories')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name')

      if (mainError) throw mainError

      // Get all subcategories for this user
      const { data: subcategories, error: subError } = await supabase
        .from('subcategories')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name')

      if (subError) throw subError

      // Group subcategories by main category
      const result: CategoryWithSubcategories[] = (mainCategories || []).map(mainCat => ({
        id: mainCat.id,
        name: mainCat.name,
        type: mainCat.type,
        emoji: mainCat.emoji,
        is_active: mainCat.is_active,
        subcategories: (subcategories || []).filter(sub => sub.main_category_id === mainCat.id)
      }))

      return result
    } catch (error) {
      console.error('Error loading categories:', error)
      throw error
    }
  }

  async getAllCategoriesFlat(userId: string): Promise<CategoryItem[]> {
    try {
      // Get main categories
      const { data: mainCategories, error: mainError } = await supabase
        .from('main_categories')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name')

      if (mainError) throw mainError

      // Get subcategories
      const { data: subcategories, error: subError } = await supabase
        .from('subcategories')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('name')

      if (subError) throw subError

const result: CategoryItem[] = [] as CategoryItem[]

       // Add main categories
       const mainCategoriesArray = mainCategories || [];
       mainCategoriesArray.forEach((category) => {
         result.push({
           id: category.id,
           name: category.name,
           type: category.type,
           is_active: category.is_active,
           isSubcategory: false,
           parentId: undefined,
           budgetAmount: undefined,
           budgetPeriod: undefined
         })
       });

       // Add subcategories
       (subcategories || []).forEach((category) => {
         result.push({
           id: category.id,
           name: category.name,
           type: category.type,
           is_active: category.is_active,
           isSubcategory: true,
           parentId: category.main_category_id,
           budgetAmount: category.budget_amount,
           budgetPeriod: category.budget_period
         })
       })

       return result
    } catch (error) {
      console.error('Error loading categories:', error)
      throw error
    }
  }

  async addMainCategory(userId: string, name: string, type: 'income' | 'expense', isActive: boolean = true) {
    try {
      const { data, error } = await supabase
        .from('main_categories')
        .insert({
          user_id: userId,
          name,
          type,
          is_active: isActive
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding main category:', error)
      throw error
    }
  }

  async addSubcategory(
    userId: string,
    mainCategoryId: string,
    name: string,
    budgetAmount?: number,
    budgetPeriod?: 'weekly' | 'monthly' | 'yearly',
    isActive: boolean = true
  ) {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .insert({
          user_id: userId,
          main_category_id: mainCategoryId,
          name,
          budget_amount: budgetAmount,
          budget_period: budgetPeriod,
          is_active: isActive
        })
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error adding subcategory:', error)
      throw error
    }
  }

  async updateMainCategory(id: string, name: string, type: 'income' | 'expense', isActive?: boolean) {
    try {
      const updateData: { name: string; type: 'income' | 'expense'; is_active?: boolean } = { name, type }
      if (isActive !== undefined) {
        updateData.is_active = isActive
      }
      
      const { data, error } = await supabase
        .from('main_categories')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating main category:', error)
      throw error
    }
  }

  async updateSubcategory(
    id: string,
    name: string,
    budgetAmount?: number,
    budgetPeriod?: 'weekly' | 'monthly' | 'yearly',
    isActive?: boolean
  ) {
    try {
      const updateData: {
        name: string;
        budget_amount?: number;
        budget_period?: 'weekly' | 'monthly' | 'yearly';
        is_active?: boolean;
      } = {
        name,
        budget_amount: budgetAmount,
        budget_period: budgetPeriod
      }
      if (isActive !== undefined) {
        updateData.is_active = isActive
      }
      
      const { data, error } = await supabase
        .from('subcategories')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error updating subcategory:', error)
      throw error
    }
  }

  async deleteMainCategory(id: string) {
    try {
      const { error } = await supabase
        .from('main_categories')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting main category:', error)
      throw error
    }
  }

  async deleteSubcategory(id: string) {
    try {
      const { error } = await supabase
        .from('subcategories')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting subcategory:', error)
      throw error
    }
  }

  async getBudgetSummary(userId: string): Promise<BudgetSummary> {
    try {
      // Get subcategories with budgets (including zero budgets)
      const { data: categories, error: categoriesError } = await supabase
        .from('subcategories')
        .select('*')
        .eq('user_id', userId)
        .gte('budget_amount', 0)

      if (categoriesError) throw categoriesError

      // Get transactions for this month
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('amount, category')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .gte('date', startOfMonth.toISOString().split('T')[0])

      if (transactionsError) throw transactionsError

      // Internal transfer category IDs to exclude from calculations
      const internalTransferCategoryIds = [
        '90eae994-67f1-426e-a8bc-ff6e2dbab51c', // Other - Internal Transfer
        'ece52746-3984-4a1e-b8a4-dadfd916612e'  // Salary - Internal Transfer
      ]

      // Calculate spending by category
      const spendingByCategory: { [key: string]: number } = {}
      transactions?.forEach(transaction => {
        if (transaction.category && !internalTransferCategoryIds.includes(transaction.category)) {
          spendingByCategory[transaction.category] = 
            (spendingByCategory[transaction.category] || 0) + transaction.amount
        }
      })

      // Build budget summary
      const categoryBudgets = categories?.map(subcategory => {
        const spent = spendingByCategory[subcategory.id] || 0
        const budgetAmount = subcategory.budget_amount || 0
        const remaining = budgetAmount - spent
        const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0

        return {
          id: subcategory.id,
          name: subcategory.name,
          budgetAmount,
          spent,
          remaining,
          percentage
        }
      }) || []

      const totalBudget = categoryBudgets.reduce((sum, cat) => sum + cat.budgetAmount, 0)
      const totalSpent = categoryBudgets.reduce((sum, cat) => sum + cat.spent, 0)

      return {
        totalBudget,
        totalSpent,
        categories: categoryBudgets
      }
    } catch (error) {
      console.error('Error getting budget summary:', error)
      throw error
    }
  }
}

export const categoriesServiceFallback = new CategoriesServiceFallback()