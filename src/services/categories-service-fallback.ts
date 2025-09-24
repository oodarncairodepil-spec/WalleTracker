import { supabase } from '../lib/supabase'
import type { Category, Subcategory } from '../lib/supabase'

// Fallback service that uses the original categories table
// This will work until the new main_categories and subcategories tables are created

export interface CategoryWithSubcategories {
  id: string
  name: string
  type: 'income' | 'expense'
  is_active: boolean
  subcategories: Subcategory[]
}

export interface CategoryItem {
  id: string
  name: string
  type: 'income' | 'expense'
  is_active: boolean
  isSubcategory: boolean
  parentId?: string
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
  mainCategories: Array<{
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
           parentId: undefined
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
           parentId: category.main_category_id
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
    isActive: boolean = true
  ) {
    try {
      const insertData = {
        user_id: userId,
        main_category_id: mainCategoryId,
        name,
        is_active: isActive
      }

      const { data, error } = await supabase
        .from('subcategories')
        .insert(insertData)
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
    isActive?: boolean
  ) {
    try {
      const updateData: {
        name: string;
        is_active?: boolean;
      } = {
        name
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

  async updateSubcategoryBudget(
    id: string,
    budgetAmount: number,
    budgetPeriod?: string,
    budgetPeriodCustom?: string
  ) {
    try {
      const updateData: {
        budget_amount: number;
        budget_period?: string;
        budget_period_custom?: string;
      } = {
        budget_amount: budgetAmount
      }
      
      if (budgetPeriod !== undefined) {
        updateData.budget_period = budgetPeriod
      }
      
      if (budgetPeriodCustom !== undefined) {
        updateData.budget_period_custom = budgetPeriodCustom
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
      console.error('Error updating subcategory budget:', error)
      throw error
    }
  }

  // New method to update budget using the budgets table for period-specific budgets
  async updateSubcategoryBudgetForPeriod(
    userId: string,
    subcategoryId: string,
    budgetAmount: number,
    periodStartDate: string,
    periodEndDate: string,
    periodType: 'monthly' | 'weekly' | 'yearly' | 'custom' = 'monthly'
  ) {
    try {
      // Get subcategory details for category_name and category_type
      const { data: subcategory, error: subcategoryError } = await supabase
        .from('subcategories')
        .select('name, main_category_id')
        .eq('id', subcategoryId)
        .single()

      if (subcategoryError) throw subcategoryError

      // Get main category to determine type
      const { data: mainCategory, error: mainCategoryError } = await supabase
        .from('main_categories')
        .select('type')
        .eq('id', subcategory.main_category_id)
        .single()

      if (mainCategoryError) throw mainCategoryError

      // Check if budget already exists for this period
      const { data: existingBudget, error: checkError } = await supabase
        .from('budgets')
        .select('id')
        .eq('user_id', userId)
        .eq('subcategory_id', subcategoryId)
        .eq('period_start_date', periodStartDate)
        .eq('period_end_date', periodEndDate)
        .single()

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw checkError
      }

      if (existingBudget) {
        // Update existing budget
        const { data, error } = await supabase
          .from('budgets')
          .update({ budgeted_amount: budgetAmount })
          .eq('id', existingBudget.id)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        // Create new budget
        const { data, error } = await supabase
          .from('budgets')
          .insert({
            user_id: userId,
            period_start_date: periodStartDate,
            period_end_date: periodEndDate,
            period_type: periodType,
            subcategory_id: subcategoryId,
            category_name: subcategory.name,
            category_type: mainCategory.type,
            budgeted_amount: budgetAmount
          })
          .select()
          .single()

        if (error) throw error
        return data
      }
    } catch (error) {
      console.error('Error updating subcategory budget for period:', error)
      throw error
    }
  }

  // Get budget for a specific subcategory and period
  async getSubcategoryBudgetForPeriod(
    userId: string,
    subcategoryId: string,
    periodStartDate: string,
    periodEndDate: string
  ) {
    try {
      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('subcategory_id', subcategoryId)
        .eq('period_start_date', periodStartDate)
        .eq('period_end_date', periodEndDate)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }

      return data
    } catch (error) {
      console.error('Error getting subcategory budget for period:', error)
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
        .eq('status', 'paid')
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
        categories: categoryBudgets,
        mainCategories: [] // Will be implemented when needed
      }
    } catch (error) {
      console.error('Error getting budget summary:', error)
      throw error
    }
  }

  async getBudgetSummaryByDateRange(userId: string, startDate: string, endDate: string): Promise<BudgetSummary> {
    try {
      // Get all subcategories for this user with main category relationship
      const { data: subcategories, error: subcategoriesError } = await supabase
        .from('subcategories')
        .select('id, name, main_category_id')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (subcategoriesError) throw subcategoriesError

      // Get budgets for the specified period from budgets table
      const { data: budgets, error: budgetsError } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', userId)
        .eq('period_start_date', startDate)
        .eq('period_end_date', endDate)
        .eq('category_type', 'expense')

      if (budgetsError) throw budgetsError

      // Get transactions for the specified date range
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('amount, category')
        .eq('user_id', userId)
        .eq('type', 'expense')
        .eq('status', 'paid')
        .gte('date', startDate)
        .lte('date', endDate)

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

      // Create a map of budgets by subcategory_id for quick lookup
      const budgetsBySubcategory: { [key: string]: number } = {}
      budgets?.forEach(budget => {
        if (budget.subcategory_id) {
          budgetsBySubcategory[budget.subcategory_id] = budget.budgeted_amount || 0
        }
      })

      // Build budget summary for all subcategories
      const categoryBudgets = subcategories?.map(subcategory => {
        const spent = spendingByCategory[subcategory.id] || 0
        const budgetAmount = budgetsBySubcategory[subcategory.id] || 0
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

      // Get main categories and calculate their totals
      const { data: mainCategories, error: mainCategoriesError } = await supabase
        .from('main_categories')
        .select('id, name')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('type', 'expense')

      if (mainCategoriesError) throw mainCategoriesError

      // Calculate main category totals by aggregating subcategories
       const mainCategoryBudgets = mainCategories?.map(mainCategory => {
         // Get all subcategories for this main category
         const subcategoriesForMain = subcategories?.filter(sub => 
           sub.main_category_id === mainCategory.id
         ) || []
         
         // Sum up budgets and spending for this main category's subcategories
         let mainCategoryBudgetAmount = 0
         let mainCategorySpent = 0
         
         subcategoriesForMain.forEach(subcategory => {
           const subcategoryBudget = categoryBudgets.find(budget => budget.id === subcategory.id)
           if (subcategoryBudget) {
             mainCategoryBudgetAmount += subcategoryBudget.budgetAmount
             mainCategorySpent += subcategoryBudget.spent
           }
         })
         
         const remaining = mainCategoryBudgetAmount - mainCategorySpent
         const percentage = mainCategoryBudgetAmount > 0 ? (mainCategorySpent / mainCategoryBudgetAmount) * 100 : 0

         return {
           id: mainCategory.id,
           name: mainCategory.name,
           budgetAmount: mainCategoryBudgetAmount,
           spent: mainCategorySpent,
           remaining,
           percentage
         }
       }) || []

      return {
        totalBudget,
        totalSpent,
        categories: categoryBudgets,
        mainCategories: mainCategoryBudgets
      }
    } catch (error) {
      console.error('Error getting budget summary by date range:', error)
      throw error
    }
  }
}

export const categoriesServiceFallback = new CategoriesServiceFallback()