'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Wallet, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { transactionService } from '../services/transaction-service'
import { fundsService } from '../services/funds-service'
import { categoriesServiceV2, type MainCategory, type Subcategory } from '../services/categories-service-v2'
import { categoriesServiceFallback } from '../services/categories-service-fallback'
import type { Transaction, Fund } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'
import { formatIDR } from '../lib/utils'

interface CategoryBudget {
  id: string
  category: string
  spent: number
  budget: number
  remaining: number
}

interface GroupedCategoryBudget {
  mainCategory: MainCategory
  totalSpent: number
  totalBudget: number
  totalRemaining: number
  subcategories: CategoryBudget[]
  isExpanded: boolean
}

export function Homepage() {
  const { user, loading: authLoading } = useAuth()
  const [totalBalance, setTotalBalance] = useState(0)
  const [funds, setFunds] = useState<Fund[]>([])
  const [showFundsList, setShowFundsList] = useState(false)
  const [unpaidExpenses, setUnpaidExpenses] = useState<Transaction[]>([])
  const [unpaidTotal, setUnpaidTotal] = useState(0)
  const [showUnpaidList, setShowUnpaidList] = useState(false)

  const [groupedCategoryBudgets, setGroupedCategoryBudgets] = useState<GroupedCategoryBudget[]>([])
  const [showCategoryDetails, setShowCategoryDetails] = useState(false)
  const [categories, setCategories] = useState<MainCategory[]>([])
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([])
  const [loading, setLoading] = useState(true)

  console.log('[HOMEPAGE DEBUG] Component render - user:', user ? 'EXISTS' : 'NULL', 'authLoading:', authLoading, 'loading:', loading)

  const loadDashboardData = useCallback(async () => {
    console.log('[HOMEPAGE DEBUG] loadDashboardData called - user:', user ? 'EXISTS' : 'NULL')
    if (!user) {
      console.log('[HOMEPAGE DEBUG] No user, returning early')
      return
    }
    
    try {
      console.log('[HOMEPAGE DEBUG] Starting to load dashboard data, setting loading to true')
      setLoading(true)
      
      // Load funds and total balance
      console.log('[HOMEPAGE DEBUG] Loading funds and total balance...')
      const allFunds = await fundsService.getFunds()
      console.log('[HOMEPAGE DEBUG] Funds loaded:', allFunds.length)
      setFunds(allFunds)
      
      const balance = await fundsService.getTotalBalance()
      console.log('[HOMEPAGE DEBUG] Total balance loaded:', balance)
      setTotalBalance(balance)
      
      // Load categories with subcategories
       console.log('[HOMEPAGE DEBUG] Loading categories with subcategories...')
       const categoriesWithSubsResult = await categoriesServiceV2.getCategoriesWithSubcategories(user.id, 'expense')
       
      if (categoriesWithSubsResult.error) {
        console.error('Error loading categories with subcategories:', categoriesWithSubsResult.error)
      } else {
        const categoriesWithSubs = categoriesWithSubsResult.data || []
        
        // Extract main categories and all subcategories for backward compatibility
        setCategories(categoriesWithSubs)
        const allSubs = categoriesWithSubs.flatMap(cat => cat.subcategories)
        setAllSubcategories(allSubs)
      }
      
      // Load unpaid expenses
      console.log('[HOMEPAGE DEBUG] Loading unpaid expenses...')
      const unpaid = await transactionService.getUnpaidExpenses()
      console.log('[HOMEPAGE DEBUG] Unpaid expenses loaded:', unpaid)
      setUnpaidExpenses(unpaid)
      
      const unpaidAmount = await transactionService.getUnpaidExpensesTotal()
      setUnpaidTotal(unpaidAmount)
      
      // Load category budgets from database
      console.log('[HOMEPAGE DEBUG] Loading category budgets from database...')
      try {
        const budgetSummary = await categoriesServiceFallback.getBudgetSummary(user.id)
        const budgets: CategoryBudget[] = budgetSummary.categories.map(category => ({
          id: category.id,
          category: category.name,
          spent: category.spent,
          budget: category.budgetAmount,
          remaining: category.remaining
        }))
        console.log('[HOMEPAGE DEBUG] Category budgets loaded from database:', budgets.length, 'items')
        
        // Create grouped budget structure
        if (categoriesWithSubsResult.data) {
          const grouped: GroupedCategoryBudget[] = categoriesWithSubsResult.data.map(mainCategory => {
            const subcategoryBudgets = mainCategory.subcategories.map(sub => {
              const budget = budgets.find(b => b.id === sub.id)
              return budget || {
                id: sub.id,
                category: sub.name,
                spent: 0,
                budget: sub.budget_amount,
                remaining: sub.budget_amount
              }
            })
            
            const totalSpent = subcategoryBudgets.reduce((sum, sub) => sum + sub.spent, 0)
            const totalBudget = subcategoryBudgets.reduce((sum, sub) => sum + sub.budget, 0)
            const totalRemaining = totalBudget - totalSpent
            
            return {
              mainCategory,
              totalSpent,
              totalBudget,
              totalRemaining,
              subcategories: subcategoryBudgets,
              isExpanded: false
            }
          })
          
          console.log('[HOMEPAGE DEBUG] Grouped category budgets created:', grouped.length, 'main categories')
          setGroupedCategoryBudgets(grouped)
        }
      } catch (error) {
        console.error('[HOMEPAGE DEBUG] Error loading budget data from database:', error)
        // Fallback to empty array if database fails
        setGroupedCategoryBudgets([])
      }
    } catch (error) {
      console.error('[HOMEPAGE DEBUG] Error loading dashboard data:', error)
    } finally {
      console.log('[HOMEPAGE DEBUG] Dashboard data loading complete, setting loading to false')
      setLoading(false)
    }
  }, [user])

  // Helper function to get category name by ID (checks both main categories and subcategories)
  const getCategoryName = (categoryId: string) => {
    // First check main categories
    const mainCategory = categories.find(cat => cat.id === categoryId)
    if (mainCategory) {
      return mainCategory.name
    }
    
    // Check subcategories
    const subcategory = allSubcategories.find(sub => sub.id === categoryId)
    if (subcategory) {
      return subcategory.name
    }
    
    // Return the categoryId if not found
    return categoryId
  }

  useEffect(() => {
    console.log('[HOMEPAGE DEBUG] useEffect triggered - user:', user ? 'EXISTS' : 'NULL', 'authLoading:', authLoading)
    if (user) {
      console.log('[HOMEPAGE DEBUG] User exists, calling loadDashboardData')
      loadDashboardData()
    } else if (!authLoading) {
      console.log('[HOMEPAGE DEBUG] No user and auth not loading, setting loading to false')
      // If no user and auth is not loading, set loading to false
      setLoading(false)
    }
  }, [user, authLoading, loadDashboardData])

  const formatCurrency = (amount: number) => {
    return formatIDR(amount)
  }
  
  const toggleCategoryExpansion = (categoryId: string) => {
    setGroupedCategoryBudgets(prev => 
      prev.map(group => 
        group.mainCategory.id === categoryId 
          ? { ...group, isExpanded: !group.isExpanded }
          : group
      )
    )
  }

  if (loading || authLoading) {
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
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowFundsList(!showFundsList)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            {showFundsList ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            Total Balance
          </CardTitle>
          <Wallet className="h-3 w-3 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-0 pb-2">
          <div className={`text-lg font-bold ${
            totalBalance >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(totalBalance)}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {funds.filter(fund => fund.status === 'Active').length} funding sources
          </p>
          {showFundsList && (
             <div className="mt-4 space-y-2">
               {funds.filter(fund => fund.status === 'Active').map((fund) => (
                 <div key={fund.id} className="bg-card text-card-foreground flex flex-col gap-6 rounded-xl py-6 cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm">
                   <div className="grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-1.5">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center space-x-2">
                         {fund.image_url ? (
                           <Image 
                             alt={fund.name} 
                             width={24} 
                             height={24} 
                             className="w-6 h-6 rounded-md object-cover" 
                             src={fund.image_url}
                           />
                         ) : (
                           <div className="w-6 h-6 bg-gradient-to-br from-teal-500 to-teal-600 rounded-md flex items-center justify-center text-white font-bold text-xs">
                             {fund.name.substring(0, 2).toUpperCase()}
                           </div>
                         )}
                         <div className="flex-1">
                           <div className="text-xs font-medium text-gray-800">{fund.name}</div>
                         </div>
                       </div>
                       <div className="text-right">
                         <div className="text-sm font-semibold text-gray-900">{formatIDR(fund.balance)}</div>
                       </div>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </CardContent>
      </Card>

      {/* Unpaid Expenses Card */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowUnpaidList(!showUnpaidList)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            {showUnpaidList ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            Unpaid Expenses
          </CardTitle>
          <AlertCircle className="h-3 w-3 text-red-500" />
        </CardHeader>
        <CardContent className="pt-0 pb-2">
          <div className="text-lg font-bold text-red-600">
              {formatIDR(unpaidTotal)}
            </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unpaidExpenses.length} pending transaction{unpaidExpenses.length !== 1 ? 's' : ''}
          </p>
          

          
          {showUnpaidList && (
             <div className="mt-4 space-y-2">
               {unpaidExpenses.map((transaction) => (
                 <div key={transaction.id} className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200">
                   <div className="flex justify-between items-start">
                     <div className="flex-1">
                       <div className="font-semibold text-gray-900 text-base mb-1">{getCategoryName(transaction.category)}</div>
                       <div className="text-sm text-gray-500 mb-2">{transaction.fund?.name || 'Unknown Fund'}</div>
                     </div>
                     <div className="text-right">
                       <div className="font-bold text-lg mb-1 text-red-600">-{formatIDR(transaction.amount)}</div>
                       <div className="text-xs text-gray-400">{new Date(transaction.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/ /g, ' ')}</div>
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </CardContent>
      </Card>

      {/* Category Budgets Card */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowCategoryDetails(!showCategoryDetails)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            {showCategoryDetails ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            Category Budgets
          </CardTitle>
          <Wallet className="h-3 w-3 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-0 pb-2">
          {(() => {
            const totalRemaining = groupedCategoryBudgets.reduce((sum, group) => sum + group.totalRemaining, 0)
            return (
              <>
                <div className={`text-lg font-bold ${
                  totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(totalRemaining)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {groupedCategoryBudgets.length} categories
                </p>
              </>
            )
          })()}
          
          {showCategoryDetails && (
            <div className="mt-4 space-y-4">
              {groupedCategoryBudgets.map((group) => {
                const mainPercentage = group.totalBudget > 0 ? (group.totalSpent / group.totalBudget) * 100 : (group.totalSpent > 0 ? 100 : 0)
                const isMainOverBudget = group.totalRemaining < 0
                
                return (
                  <div key={group.mainCategory.id} className="space-y-2">
                    {/* Main Category */}
                    <div 
                      className="cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleCategoryExpansion(group.mainCategory.id)
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                             {group.mainCategory.name}
                           </span>
                          {group.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                        <Badge variant={isMainOverBudget ? 'destructive' : 'secondary'}>
                          {formatCurrency(Math.abs(group.totalRemaining))} {isMainOverBudget ? 'over' : 'left'}
                        </Badge>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className={`h-2 rounded-full transition-all ${
                            isMainOverBudget 
                              ? 'bg-red-500' 
                              : mainPercentage > 80 
                                ? 'bg-yellow-500' 
                                : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(mainPercentage, 100)}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{formatCurrency(group.totalSpent)} spent</span>
                        <span>{formatCurrency(group.totalBudget)} budget</span>
                      </div>
                    </div>
                    
                    {/* Subcategories */}
                    {group.isExpanded && (
                      <div className="ml-4 space-y-3 border-l-2 border-gray-200 pl-4">
                        {group.subcategories.map((budget) => {
                          const percentage = budget.budget > 0 ? (budget.spent / budget.budget) * 100 : (budget.spent > 0 ? 100 : 0)
                          const isOverBudget = budget.remaining < 0
                          
                          return (
                            <div key={budget.id} className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm">{budget.category}</span>
                                <Badge variant={isOverBudget ? 'destructive' : 'secondary'} className="text-xs">
                                  {formatCurrency(Math.abs(budget.remaining))} {isOverBudget ? 'over' : 'left'}
                                </Badge>
                              </div>
                              
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div 
                                  className={`h-1.5 rounded-full transition-all ${
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
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}