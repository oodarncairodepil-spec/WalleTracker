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
import { dateRangeService } from '../services/date-range-service'
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
  const [currentPeriodDescription, setCurrentPeriodDescription] = useState('')

  console.log('[HOMEPAGE DEBUG] Component render - user:', user ? 'EXISTS' : 'NULL', 'authLoading:', authLoading, 'loading:', loading)

  // Function to get nearest unpaid expense date and days difference
  const getNearestUnpaidExpense = () => {
    if (unpaidExpenses.length === 0) return null
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Sort unpaid expenses by date (ascending)
    const sortedExpenses = [...unpaidExpenses].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    // Find the nearest date (could be past or future)
    let nearestExpense = sortedExpenses[0]
    let minDifference = Math.abs(new Date(sortedExpenses[0].date).getTime() - today.getTime())
    
    for (const expense of sortedExpenses) {
      const expenseDate = new Date(expense.date)
      expenseDate.setHours(0, 0, 0, 0)
      const difference = Math.abs(expenseDate.getTime() - today.getTime())
      
      if (difference < minDifference) {
        minDifference = difference
        nearestExpense = expense
      }
    }
    
    const nearestDate = new Date(nearestExpense.date)
    nearestDate.setHours(0, 0, 0, 0)
    const daysDifference = Math.ceil((nearestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    
    return {
      date: nearestDate,
      daysDifference,
      expense: nearestExpense
    }
  }

  const loadDashboardData = useCallback(async () => {
    console.log('[HOMEPAGE DEBUG] loadDashboardData called - user:', user ? 'EXISTS' : 'NULL')
    if (!user) {
      console.log('[HOMEPAGE DEBUG] No user, returning early')
      return
    }
    
    try {
      console.log('[HOMEPAGE DEBUG] Starting to load dashboard data, setting loading to true')
      setLoading(true)
      
      // Parallelize initial data loading for better performance
      console.log('[HOMEPAGE DEBUG] Starting parallel data loading...')
      
      const [
        currentPeriod,
        periodDescription,
        allFunds,
        balance,
        categoriesWithSubsResult
      ] = await Promise.all([
        dateRangeService.getCurrentPeriodRange(),
        dateRangeService.getCurrentPeriodDescription(),
        fundsService.getFunds(),
        fundsService.getTotalBalance(),
        categoriesServiceV2.getCategoriesWithSubcategories(user.id, 'expense')
      ])
      
      // Load unpaid expenses for current period using server-side filtering
      const unpaidInPeriod = await transactionService.getUnpaidExpensesByDateRange(
        currentPeriod.startDate,
        currentPeriod.endDate
      )
      
      console.log('[HOMEPAGE DEBUG] Parallel loading complete')
      console.log('[HOMEPAGE DEBUG] Current period:', currentPeriod, 'Description:', periodDescription)
      console.log('[HOMEPAGE DEBUG] Funds loaded:', allFunds.length)
      console.log('[HOMEPAGE DEBUG] Total balance loaded:', balance)
      
      // Set the loaded data
      setCurrentPeriodDescription(periodDescription)
      setFunds(allFunds)
      setTotalBalance(balance)
      
      // Process categories
      if (categoriesWithSubsResult.error) {
        console.error('Error loading categories with subcategories:', categoriesWithSubsResult.error)
      } else {
        const categoriesWithSubs = categoriesWithSubsResult.data || []
        setCategories(categoriesWithSubs)
        const allSubs = categoriesWithSubs.flatMap(cat => cat.subcategories)
        setAllSubcategories(allSubs)
      }
      
      console.log('[HOMEPAGE DEBUG] Unpaid expenses loaded:', unpaidInPeriod.length, 'for current period')
      setUnpaidExpenses(unpaidInPeriod)
      
      // Calculate unpaid total for current period
      const internalTransferCategoryIds = [
        '90eae994-67f1-426e-a8bc-ff6e2dbab51c', // Other - Internal Transfer
        'ece52746-3984-4a1e-b8a4-dadfd916612e'  // Salary - Internal Transfer
      ]
      const unpaidAmount = unpaidInPeriod
        .filter(expense => !internalTransferCategoryIds.includes(expense.category))
        .reduce((total, expense) => total + expense.amount, 0)
      setUnpaidTotal(unpaidAmount)
      
      // Load category budgets for current period in parallel with other operations
      console.log('[HOMEPAGE DEBUG] Loading category budgets for current period...')
      try {
        const budgetSummary = await categoriesServiceFallback.getBudgetSummaryByDateRange(
           user.id,
           currentPeriod.startDate,
           currentPeriod.endDate
         )
        const budgets: CategoryBudget[] = budgetSummary.categories.map(category => ({
          id: category.id,
          category: category.name,
          spent: category.spent,
          budget: category.budgetAmount,
          remaining: category.remaining
        }))
        console.log('[HOMEPAGE DEBUG] Category budgets loaded for period:', budgets.length, 'items')
        
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
    
    // Return a user-friendly fallback instead of UUID
    return 'Unknown Category'
  }

  // Helper function to get category display name with main category and subcategory
  const getCategoryDisplayName = (categoryId: string) => {
    // First check if it's a main category
    const mainCategory = categories.find(cat => cat.id === categoryId)
    if (mainCategory) {
      return mainCategory.name
    }
    
    // Check if it's a subcategory
    const subcategory = allSubcategories.find(sub => sub.id === categoryId)
    if (subcategory) {
      // Find the main category for this subcategory
      const parentCategory = categories.find(cat => cat.id === subcategory.main_category_id)
      if (parentCategory) {
        return `${parentCategory.name} - ${subcategory.name}`
      }
      return subcategory.name
    }
    
    // Return a user-friendly fallback instead of UUID
    return 'Unknown Category'
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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WalleTracker</h1>
            {currentPeriodDescription && (
              <p className="text-sm text-gray-600 mt-1">Period: {currentPeriodDescription}</p>
            )}
          </div>
          <div className="w-10 h-10"></div> {/* Spacer for avatar */}
        </div>
      </div>
      
      <div className="px-4 space-y-3">
        {/* Total Balance Card */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowFundsList(!showFundsList)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2 px-3">
          <CardTitle className="text-xs font-medium flex items-center gap-1">
            {showFundsList ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
            Total Balance
          </CardTitle>
          <Wallet className="h-3 w-3 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-1 pb-2 px-3">
          <div className={`text-base font-bold ${
            totalBalance >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatCurrency(totalBalance)}
          </div>
          <p className="text-xs text-muted-foreground">
            {funds.filter(fund => fund.status === 'Active').length} sources
          </p>
          {showFundsList && (
             <div className="mt-2 space-y-1">
               {funds.filter(fund => fund.status === 'Active').map((fund) => (
                 <div key={fund.id} className="bg-gray-50 rounded-lg p-2 cursor-pointer hover:bg-gray-100 transition-colors">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center space-x-2">
                       {fund.image_url ? (
                         <Image 
                           alt={fund.name} 
                           width={16} 
                           height={16} 
                           className="w-4 h-4 rounded object-cover" 
                           src={fund.image_url}
                         />
                       ) : (
                         <div className="w-4 h-4 bg-gradient-to-br from-teal-500 to-teal-600 rounded flex items-center justify-center text-white font-bold text-[8px]">
                           {fund.name.substring(0, 1).toUpperCase()}
                         </div>
                       )}
                       <div className="text-xs font-medium text-gray-800">{fund.name}</div>
                     </div>
                     <div className="text-xs font-semibold text-gray-900">{formatIDR(fund.balance)}</div>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </CardContent>
      </Card>

      {/* Unpaid Expenses Card */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowUnpaidList(!showUnpaidList)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-2 px-3">
          <CardTitle className="text-xs font-medium flex items-center gap-1">
            {showUnpaidList ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
            Unpaid Expenses
          </CardTitle>
          <AlertCircle className="h-3 w-3 text-red-500" />
        </CardHeader>
        <CardContent className="pt-1 pb-2 px-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-base font-bold text-red-600">
                {formatIDR(unpaidTotal)}
              </div>
              <p className="text-xs text-muted-foreground">
                {unpaidExpenses.length} pending
              </p>
            </div>
            {(() => {
              const nearestExpense = getNearestUnpaidExpense()
              if (!nearestExpense) return null
              
              const formatDate = (date: Date) => {
                return date.toLocaleDateString('en-GB', { 
                  day: 'numeric', 
                  month: 'short', 
                  year: 'numeric' 
                }).replace(/ /g, ' ')
              }
              
              const dayText = Math.abs(nearestExpense.daysDifference) === 1 ? 'day' : 'days'
              const daysDisplay = nearestExpense.daysDifference === 0 
                ? 'today'
                : nearestExpense.daysDifference > 0 
                  ? `${nearestExpense.daysDifference} ${dayText}`
                  : `${Math.abs(nearestExpense.daysDifference)} ${dayText} ago`
              
              return (
                <div className="text-right">
                  <div className="text-xs font-medium text-gray-700">
                    {formatDate(nearestExpense.date)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ({daysDisplay})
                  </div>
                </div>
              )
            })()}
          </div>
          

          
          {showUnpaidList && (
             <div className="mt-2 space-y-1">
               {(() => {
                 const today = new Date()
                 today.setHours(0, 0, 0, 0)
                 
                 // Sort unpaid expenses by nearest date to today
                 const sortedExpenses = [...unpaidExpenses].sort((a, b) => {
                   const dateA = new Date(a.date)
                   const dateB = new Date(b.date)
                   dateA.setHours(0, 0, 0, 0)
                   dateB.setHours(0, 0, 0, 0)
                   
                   const diffA = Math.abs(dateA.getTime() - today.getTime())
                   const diffB = Math.abs(dateB.getTime() - today.getTime())
                   
                   return diffA - diffB
                 })
                 
                 return sortedExpenses.map((transaction) => (
                   <div key={transaction.id} className="bg-gray-50 rounded-lg p-2 cursor-pointer hover:bg-gray-100 transition-colors">
                     <div className="flex justify-between items-center">
                       <div className="flex-1">
                         <div className="font-medium text-gray-900 text-xs">{getCategoryDisplayName(transaction.category)}</div>
                         <div className="text-xs text-gray-500 flex items-center gap-1">
                           {transaction.fund?.image_url ? (
                             <Image 
                               alt={transaction.fund.name} 
                               width={10} 
                               height={10} 
                               className="w-2.5 h-2.5 rounded-sm object-cover" 
                               src={transaction.fund.image_url}
                             />
                           ) : (
                             <div className="w-2.5 h-2.5 bg-gradient-to-br from-teal-500 to-teal-600 rounded-sm flex items-center justify-center text-white font-bold text-[6px]">
                               {(transaction.fund?.name || 'U').substring(0, 1).toUpperCase()}
                             </div>
                           )}
                           {transaction.fund?.name || 'Unknown'}
                         </div>
                       </div>
                       <div className="text-right">
                         <div className="font-semibold text-xs text-red-600">-{formatIDR(transaction.amount)}</div>
                         <div className="text-xs text-gray-400">{new Date(transaction.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).replace(/ /g, ' ')}</div>
                       </div>
                     </div>
                   </div>
                 ))
               })()}
             </div>
           )}
        </CardContent>
      </Card>

      {/* Category Budgets Card */}
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowCategoryDetails(!showCategoryDetails)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-0 pt-1 px-2">
          <CardTitle className="text-xs font-medium flex items-center gap-1">
            {showCategoryDetails ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
            Category Budgets
          </CardTitle>
          <Wallet className="h-3 w-3 text-muted-foreground" />
        </CardHeader>
        <CardContent className="pt-0 pb-1 px-2">
          {(() => {
            const totalRemaining = groupedCategoryBudgets.reduce((sum, group) => sum + group.totalRemaining, 0)
            return (
              <>
                <div className={`text-base font-bold ${
                  totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(totalRemaining)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {groupedCategoryBudgets.length} categories
                </p>
              </>
            )
          })()}
          
          {showCategoryDetails && (
            <div className="mt-1 space-y-1">
              {groupedCategoryBudgets.map((group) => {
                const mainPercentage = group.totalBudget > 0 ? (group.totalSpent / group.totalBudget) * 100 : (group.totalSpent > 0 ? 100 : 0)
                const isMainOverBudget = group.totalRemaining < 0
                
                return (
                  <div key={group.mainCategory.id} className="space-y-1">
                    {/* Main Category */}
                    <div 
                      className="cursor-pointer hover:bg-gray-50 p-1 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleCategoryExpansion(group.mainCategory.id)
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium">
                            {group.mainCategory.name}
                          </span>
                          {group.isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </div>
                        <Badge variant={isMainOverBudget ? 'destructive' : 'secondary'} className="text-xs px-1.5 py-0.5">
                          {formatCurrency(Math.abs(group.totalRemaining))} {isMainOverBudget ? 'over' : 'left'}
                        </Badge>
                      </div>
                      
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                        <div 
                          className={`h-1.5 rounded-full transition-all ${
                            isMainOverBudget 
                              ? 'bg-red-500' 
                              : mainPercentage > 80 
                                ? 'bg-yellow-500' 
                                : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(mainPercentage, 100)}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                        <span>{formatCurrency(group.totalSpent)} spent</span>
                        <span>{formatCurrency(group.totalBudget)} budget</span>
                      </div>
                    </div>
                    
                    {/* Subcategories */}
                    {group.isExpanded && (
                      <div className="ml-2 space-y-1 border-l border-gray-200 pl-2">
                        {group.subcategories.map((budget) => {
                          const percentage = budget.budget > 0 ? (budget.spent / budget.budget) * 100 : (budget.spent > 0 ? 100 : 0)
                          const isOverBudget = budget.remaining < 0
                          
                          return (
                            <div key={budget.id} className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-xs">{budget.category}</span>
                                <Badge variant={isOverBudget ? 'destructive' : 'secondary'} className="text-xs px-1 py-0">
                                  {formatCurrency(Math.abs(budget.remaining))} {isOverBudget ? 'over' : 'left'}
                                </Badge>
                              </div>
                              
                              <div className="w-full bg-gray-200 rounded-full h-1">
                                <div 
                                  className={`h-1 rounded-full transition-all ${
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
                                <span>{formatCurrency(budget.spent)}</span>
                                <span>{formatCurrency(budget.budget)}</span>
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