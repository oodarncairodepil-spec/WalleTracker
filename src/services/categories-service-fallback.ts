import { supabase } from '../lib/supabase'
import type { Category } from '../lib/supabase'

// Fallback service that uses the original categories table
// This will work until the new main_categories and subcategories tables are created

export interface CategoryWithSubcategories {
  id: string
  name: string
  type: 'income' | 'expense'
  emoji?: string
  subcategories: Category[]
}

export interface CategoryItem {
  id: string
  name: string
  type: 'income' | 'expense'
  emoji?: string
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
       mainCategoriesArray.forEach((category: any) => {
         result.push({
           id: category.id,
           name: category.name,
           type: category.type,
           emoji: category.emoji,
           isSubcategory: false,
           parentId: undefined,
           budgetAmount: undefined,
           budgetPeriod: undefined
         })
       });

       // Add subcategories
       (subcategories || []).forEach((category: any) => {
         result.push({
           id: category.id,
           name: category.name,
           type: category.type,
           emoji: category.emoji,
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

  async addMainCategory(userId: string, name: string, type: 'income' | 'expense') {
    try {
      const { data, error } = await supabase
        .from('main_categories')
        .insert({
          user_id: userId,
          name,
          type
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
    budgetPeriod?: 'weekly' | 'monthly' | 'yearly'
  ) {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .insert({
          user_id: userId,
          main_category_id: mainCategoryId,
          name,
          budget_amount: budgetAmount,
          budget_period: budgetPeriod
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

  async updateMainCategory(id: string, name: string, type: 'income' | 'expense') {
    try {
      const { data, error } = await supabase
        .from('main_categories')
        .update({ name, type })
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
    budgetPeriod?: 'weekly' | 'monthly' | 'yearly'
  ) {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .update({
          name,
          budget_amount: budgetAmount,
          budget_period: budgetPeriod
        })
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
      // Get subcategories with budgets
      const { data: categories, error: categoriesError } = await supabase
        .from('subcategories')
        .select('*')
        .eq('user_id', userId)
        .not('budget_amount', 'is', null)

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

      // Calculate spending by category
      const spendingByCategory: { [key: string]: number } = {}
      transactions?.forEach(transaction => {
        if (transaction.category) {
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