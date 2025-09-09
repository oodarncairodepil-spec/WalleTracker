import { supabase } from '../lib/supabase'
import { Budget, BudgetHistory, BudgetPerformanceSummary } from '../lib/supabase'
import { dateRangeService, DateRange } from './date-range-service'

export interface CreateBudgetRequest {
  period_start_date: string
  period_end_date: string
  period_type: 'monthly' | 'weekly' | 'yearly' | 'custom'
  main_category_id?: string
  subcategory_id?: string
  category_name: string
  category_type: 'income' | 'expense'
  budgeted_amount: number
  notes?: string
}

export interface UpdateBudgetRequest {
  budgeted_amount?: number
  actual_amount?: number
  notes?: string
}

export interface BudgetSummary {
  totalBudgeted: number
  totalActual: number
  totalVariance: number
  avgVariancePercentage: number
  categoriesOverBudget: number
  categoriesUnderBudget: number
  categoriesOnTarget: number
  budgets: Budget[]
}

export interface PeriodPerformance {
  period: DateRange
  description: string
  income: BudgetSummary
  expense: BudgetSummary
  netBudgeted: number
  netActual: number
  netVariance: number
}

export class BudgetService {
  private static instance: BudgetService
  private cache: Map<string, any> = new Map()
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  static getInstance(): BudgetService {
    if (!BudgetService.instance) {
      BudgetService.instance = new BudgetService()
    }
    return BudgetService.instance
  }

  /**
   * Create a new budget for a specific period and category
   */
  async createBudget(request: CreateBudgetRequest): Promise<{ data: Budget | null; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: new Error('User not authenticated') }
      }

      const { data, error } = await supabase
        .from('budgets')
        .insert({
          user_id: user.id,
          ...request,
          actual_amount: 0, // Start with 0 actual amount
          is_active: true,
          is_finalized: false
        })
        .select()
        .single()

      if (error) {
        return { data: null, error }
      }

      this.clearCache()
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Update an existing budget
   */
  async updateBudget(budgetId: string, request: UpdateBudgetRequest): Promise<{ data: Budget | null; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: new Error('User not authenticated') }
      }

      const { data, error } = await supabase
        .from('budgets')
        .update(request)
        .eq('id', budgetId)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        return { data: null, error }
      }

      this.clearCache()
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Delete a budget
   */
  async deleteBudget(budgetId: string): Promise<{ error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { error: new Error('User not authenticated') }
      }

      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', budgetId)
        .eq('user_id', user.id)

      if (error) {
        return { error }
      }

      this.clearCache()
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  /**
   * Get budgets for a specific period
   */
  async getBudgetsForPeriod(periodStart: string, periodEnd: string): Promise<{ data: Budget[] | null; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: new Error('User not authenticated') }
      }

      const cacheKey = `budgets_${user.id}_${periodStart}_${periodEnd}`
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return { data: cached, error: null }
      }

      const { data, error } = await supabase
        .from('budgets')
        .select('*')
        .eq('user_id', user.id)
        .eq('period_start_date', periodStart)
        .eq('period_end_date', periodEnd)
        .eq('is_active', true)
        .order('category_type', { ascending: true })
        .order('category_name', { ascending: true })

      if (error) {
        return { data: null, error }
      }

      this.setCache(cacheKey, data)
      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Get current period budgets
   */
  async getCurrentPeriodBudgets(): Promise<{ data: Budget[] | null; error: Error | null }> {
    try {
      const currentPeriod = await dateRangeService.getCurrentPeriodRange()
      return this.getBudgetsForPeriod(currentPeriod.startDate, currentPeriod.endDate)
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Get budget performance summary for a period
   */
  async getBudgetPerformanceSummary(periodStart: string, periodEnd: string): Promise<{ data: PeriodPerformance | null; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: new Error('User not authenticated') }
      }

      const cacheKey = `performance_${user.id}_${periodStart}_${periodEnd}`
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return { data: cached, error: null }
      }

      // Get budgets for the period
      const { data: budgets, error: budgetsError } = await this.getBudgetsForPeriod(periodStart, periodEnd)
      if (budgetsError || !budgets) {
        return { data: null, error: budgetsError }
      }

      // Separate income and expense budgets
      const incomeBudgets = budgets.filter(b => b.category_type === 'income')
      const expenseBudgets = budgets.filter(b => b.category_type === 'expense')

      // Calculate summaries
      const incomeSummary = this.calculateBudgetSummary(incomeBudgets)
      const expenseSummary = this.calculateBudgetSummary(expenseBudgets)

      // Calculate net figures
      const netBudgeted = incomeSummary.totalBudgeted - expenseSummary.totalBudgeted
      const netActual = incomeSummary.totalActual - expenseSummary.totalActual
      const netVariance = netActual - netBudgeted

      // Get period description
      const description = await dateRangeService.getCurrentPeriodDescription()

      const performance: PeriodPerformance = {
        period: { startDate: periodStart, endDate: periodEnd },
        description,
        income: incomeSummary,
        expense: expenseSummary,
        netBudgeted,
        netActual,
        netVariance
      }

      this.setCache(cacheKey, performance)
      return { data: performance, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Update actual amounts for budgets based on transactions
   */
  async updateActualAmounts(periodStart: string, periodEnd: string): Promise<{ error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { error: new Error('User not authenticated') }
      }

      // Get all budgets for the period
      const { data: budgets, error: budgetsError } = await this.getBudgetsForPeriod(periodStart, periodEnd)
      if (budgetsError || !budgets) {
        return { error: budgetsError }
      }

      // Update each budget's actual amount
      for (const budget of budgets) {
        let actualAmount = 0

        // Query transactions for this category in the period
        if (budget.subcategory_id) {
          // Subcategory budget
          const { data: transactions } = await supabase
            .from('transactions')
            .select('amount')
            .eq('user_id', user.id)
            .eq('category_id', budget.subcategory_id)
            .eq('type', budget.category_type)
            .eq('status', 'paid')
            .gte('date', periodStart)
            .lte('date', periodEnd)

          actualAmount = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0
        } else if (budget.main_category_id) {
          // Main category budget - sum all subcategories
          const { data: subcategories } = await supabase
            .from('subcategories')
            .select('id')
            .eq('main_category_id', budget.main_category_id)
            .eq('is_active', true)

          if (subcategories) {
            for (const sub of subcategories) {
              const { data: transactions } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', user.id)
                .eq('category_id', sub.id)
                .eq('type', budget.category_type)
                .eq('status', 'paid')
                .gte('date', periodStart)
                .lte('date', periodEnd)

              actualAmount += transactions?.reduce((sum, t) => sum + t.amount, 0) || 0
            }
          }
        }

        // Update the budget with actual amount
        await this.updateBudget(budget.id, { actual_amount: actualAmount })
      }

      this.clearCache()
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  /**
   * Finalize a budget period (move to history)
   */
  async finalizePeriod(periodStart: string, periodEnd: string): Promise<{ error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { error: new Error('User not authenticated') }
      }

      // First update actual amounts
      const updateResult = await this.updateActualAmounts(periodStart, periodEnd)
      if (updateResult.error) {
        return updateResult
      }

      // Call the database function to finalize the period
      const { error } = await supabase.rpc('finalize_budget_period', {
        p_user_id: user.id,
        p_period_start: periodStart,
        p_period_end: periodEnd
      })

      if (error) {
        return { error }
      }

      this.clearCache()
      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  /**
   * Get budget history for analysis
   */
  async getBudgetHistory(limit: number = 12): Promise<{ data: BudgetHistory[] | null; error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { data: null, error: new Error('User not authenticated') }
      }

      const { data, error } = await supabase
        .from('budget_history')
        .select('*')
        .eq('user_id', user.id)
        .order('period_start_date', { ascending: false })
        .limit(limit)

      if (error) {
        return { data: null, error }
      }

      return { data, error: null }
    } catch (error) {
      return { data: null, error: error as Error }
    }
  }

  /**
   * Create budgets for current period based on previous period or defaults
   */
  async createCurrentPeriodBudgets(): Promise<{ error: Error | null }> {
    try {
      const currentPeriod = await dateRangeService.getCurrentPeriodRange()
      
      // Check if budgets already exist for current period
      const { data: existingBudgets } = await this.getBudgetsForPeriod(
        currentPeriod.startDate, 
        currentPeriod.endDate
      )
      
      if (existingBudgets && existingBudgets.length > 0) {
        return { error: null } // Budgets already exist
      }

      // Get previous period budgets to copy
      const previousPeriod = await dateRangeService.getPeriodRange(1) // 1 period ago
      const { data: previousBudgets } = await this.getBudgetsForPeriod(
        previousPeriod.startDate,
        previousPeriod.endDate
      )

      if (previousBudgets && previousBudgets.length > 0) {
        // Copy previous period budgets
        for (const prevBudget of previousBudgets) {
          await this.createBudget({
            period_start_date: currentPeriod.startDate,
            period_end_date: currentPeriod.endDate,
            period_type: prevBudget.period_type,
            main_category_id: prevBudget.main_category_id,
            subcategory_id: prevBudget.subcategory_id,
            category_name: prevBudget.category_name,
            category_type: prevBudget.category_type,
            budgeted_amount: prevBudget.budgeted_amount,
            notes: 'Copied from previous period'
          })
        }
      }

      return { error: null }
    } catch (error) {
      return { error: error as Error }
    }
  }

  /**
   * Helper method to calculate budget summary
   */
  private calculateBudgetSummary(budgets: Budget[]): BudgetSummary {
    const totalBudgeted = budgets.reduce((sum, b) => sum + b.budgeted_amount, 0)
    const totalActual = budgets.reduce((sum, b) => sum + b.actual_amount, 0)
    const totalVariance = totalActual - totalBudgeted
    const avgVariancePercentage = budgets.length > 0 
      ? budgets.reduce((sum, b) => sum + b.variance_percentage, 0) / budgets.length 
      : 0
    
    const categoriesOverBudget = budgets.filter(b => b.variance_amount > 0).length
    const categoriesUnderBudget = budgets.filter(b => b.variance_amount < 0).length
    const categoriesOnTarget = budgets.filter(b => b.variance_amount === 0).length

    return {
      totalBudgeted,
      totalActual,
      totalVariance,
      avgVariancePercentage,
      categoriesOverBudget,
      categoriesUnderBudget,
      categoriesOnTarget,
      budgets
    }
  }

  /**
   * Cache management
   */
  private getFromCache(key: string): any {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }
    return null
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    })
  }

  private clearCache(): void {
    this.cache.clear()
  }
}

export const budgetService = BudgetService.getInstance()