'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Wallet, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { transactionService } from '../services/transaction-service'
import { fundsService } from '../services/funds-service'
import type { Transaction, Fund } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'
import { formatIDR } from '../lib/utils'

interface CategoryBudget {
  category: string
  spent: number
  budget: number
  remaining: number
}

export function Homepage() {
  const { user } = useAuth()
  const [totalBalance, setTotalBalance] = useState(0)
  const [unpaidExpenses, setUnpaidExpenses] = useState<Transaction[]>([])
  const [unpaidTotal, setUnpaidTotal] = useState(0)
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudget[]>([])
  const [loading, setLoading] = useState(true)

  // Predefined budgets for categories (in a real app, this would be user-configurable)
  const defaultBudgets: Record<string, number> = {
    'Food & Dining': 500,
    'Transportation': 200,
    'Shopping': 300,
    'Entertainment': 150,
    'Bills & Utilities': 400,
    'Healthcare': 200,
    'Education': 100,
    'Travel': 250,
    'Other': 100
  }

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      
      // Load total balance from all funds
      const balance = await fundsService.getTotalBalance()
      setTotalBalance(balance)
      
      // Load unpaid expenses
      const unpaid = await transactionService.getUnpaidExpenses()
      setUnpaidExpenses(unpaid)
      
      const unpaidAmount = await transactionService.getUnpaidExpensesTotal()
      setUnpaidTotal(unpaidAmount)
      
      // Load category totals and calculate budgets
      const categoryTotals = await transactionService.getCategoryTotals()
      const budgets: CategoryBudget[] = Object.entries(defaultBudgets).map(([category, budget]) => {
        const spent = categoryTotals[category] || 0
        return {
          category,
          spent,
          budget,
          remaining: budget - spent
        }
      })
      
      setCategoryBudgets(budgets)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return formatIDR(amount)
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        {/* Header */}
        <div className="bg-white shadow-sm border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">WalleTracker</h1>
            <div className="w-10 h-10"></div> {/* Spacer for avatar */}
          </div>
        </div>
        
        <div className="px-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-gray-200 rounded-lg"></div>
            <div className="h-32 bg-gray-200 rounded-lg"></div>
            <div className="h-48 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">WalleTracker</h1>
          <div className="w-10 h-10"></div> {/* Spacer for avatar */}
        </div>
      </div>
      
      <div className="px-6 space-y-6">
        {/* Total Balance Card */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-xs font-medium">Total Balance</CardTitle>
          <Wallet className="h-3 w-3 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-1 pb-2">
          <div className={`text-lg font-bold ${
            totalBalance >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(totalBalance)}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Across all funding sources
          </p>
        </CardContent>
      </Card>

      {/* Unpaid Expenses Card */}
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-xs font-medium">Unpaid Expenses</CardTitle>
          <AlertCircle className="h-3 w-3 text-red-500" />
        </CardHeader>
        <CardContent className="pt-1 pb-2">
          <div className="text-lg font-bold text-red-600">
            {formatCurrency(unpaidTotal)}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unpaidExpenses.length} pending transaction{unpaidExpenses.length !== 1 ? 's' : ''}
          </p>
          
          {unpaidExpenses.length > 0 && (
            <div className="mt-2 space-y-1">
              <h4 className="text-xs font-medium">Recent Unpaid:</h4>
              {unpaidExpenses.slice(0, 3).map((expense) => (
                <div key={expense.id} className="flex justify-between items-center text-xs">
                  <span className="truncate">{expense.description}</span>
                  <span className="text-red-600 font-medium">
                    {formatCurrency(expense.amount)}
                  </span>
                </div>
              ))}
              {unpaidExpenses.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{unpaidExpenses.length - 3} more
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Budgets Card */}
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Category Budgets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categoryBudgets.map((budget) => {
              const percentage = budget.budget > 0 ? (budget.spent / budget.budget) * 100 : 0
              const isOverBudget = budget.remaining < 0
              
              return (
                <div key={budget.category} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{budget.category}</span>
                    <Badge variant={isOverBudget ? 'destructive' : 'secondary'}>
                      {formatCurrency(Math.abs(budget.remaining))} {isOverBudget ? 'over' : 'left'}
                    </Badge>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all ${
                        isOverBudget 
                          ? 'bg-red-500' 
                          : percentage > 80 
                            ? 'bg-yellow-500' 
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatCurrency(budget.spent)} spent</span>
                    <span>{formatCurrency(budget.budget)} budget</span>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}