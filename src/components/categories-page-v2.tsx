'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { toast } from 'sonner'
import { Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { categoriesServiceFallback, type CategoryItem, type BudgetSummary, type CategoryWithSubcategories } from '../services/categories-service-fallback'
import { dateRangeService } from '../services/date-range-service'
import { transactionService } from '../services/transaction-service'
import { budgetService } from '../services/budget-service'
import type { Category, Subcategory, Budget } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'

export function CategoriesPageV2() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([])
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null)
  const [isSubcategory, setIsSubcategory] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryType, setCategoryType] = useState<'income' | 'expense'>('expense')
  const [parentCategoryId, setParentCategoryId] = useState<string>('')
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [viewingCategory, setViewingCategory] = useState<CategoryWithSubcategories | null>(null)
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false)
  const [budgetEditingSubcategory, setBudgetEditingSubcategory] = useState<Subcategory | null>(null)
  const [budgetAmount, setBudgetAmount] = useState('')

  const [availableBudgetPeriods, setAvailableBudgetPeriods] = useState<Array<{startDate: string, endDate: string, label: string}>>([])
  const [selectedBudgetPeriod, setSelectedBudgetPeriod] = useState<{startDate: string, endDate: string, label: string} | null>(null)
  const [currentPeriodDescription, setCurrentPeriodDescription] = useState('')
  const [isSubcategoryDetailsDialogOpen, setIsSubcategoryDetailsDialogOpen] = useState(false)
  const [viewingSubcategory, setViewingSubcategory] = useState<Subcategory | null>(null)

  const loadCategories = useCallback(async () => {
    if (!user) return
    
    try {
      setLoading(true)
      setError(null)
      const data = await categoriesServiceFallback.getMainCategories(user.id)
      setCategories(data)
    } catch (err) {
      console.error('Error loading categories:', err)
      setError('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [user])

  const loadBudgetSummary = useCallback(async (period?: {startDate: string, endDate: string, label: string}) => {
    if (!user) return
    
    try {
      let summary
      if (period) {
        // Load budget summary for specific period
        summary = await categoriesServiceFallback.getBudgetSummaryByDateRange(
          user.id,
          period.startDate,
          period.endDate
        )
        setCurrentPeriodDescription(period.label)
      } else {
        // Load budget summary for current month
        summary = await categoriesServiceFallback.getBudgetSummary(user.id)
        const description = await dateRangeService.getCurrentPeriodDescription()
        setCurrentPeriodDescription(description)
      }
      setBudgetSummary(summary)
    } catch (err) {
      console.error('Error loading budget summary:', err)
    }
  }, [user])

  const loadAvailablePeriods = useCallback(async () => {
    if (!user) return
    
    try {
      // Get the oldest transaction date to generate all available periods
      const oldestTransactionDate = await transactionService.getOldestTransactionDate()
      const periods = await dateRangeService.generateAvailablePeriods(oldestTransactionDate)
      
      // If no periods are available, fall back to current period
      if (periods.length === 0) {
        const currentPeriod = await dateRangeService.getCurrentPeriodRange()
        const currentPeriodDescription = await dateRangeService.getCurrentPeriodDescription()
        const fallbackPeriods = [{
          startDate: currentPeriod.startDate,
          endDate: currentPeriod.endDate,
          label: currentPeriodDescription
        }]
        setAvailableBudgetPeriods(fallbackPeriods)
      } else {
        setAvailableBudgetPeriods(periods)
        // Set the first period (most recent) as default selected
        if (periods.length > 0) {
          setSelectedBudgetPeriod(periods[0])
        }
      }
    } catch (err) {
      console.error('Error loading available periods:', err)
      // Fallback to current period on error
      try {
        const currentPeriod = await dateRangeService.getCurrentPeriodRange()
        const currentPeriodDescription = await dateRangeService.getCurrentPeriodDescription()
        const fallbackPeriods = [{
          startDate: currentPeriod.startDate,
          endDate: currentPeriod.endDate,
          label: currentPeriodDescription
        }]
        setAvailableBudgetPeriods(fallbackPeriods)
        setSelectedBudgetPeriod(fallbackPeriods[0])
      } catch (fallbackErr) {
        console.error('Error loading fallback period:', fallbackErr)
      }
    }
  }, [user])

  useEffect(() => {
    loadCategories()
    loadAvailablePeriods()
  }, [loadCategories, loadAvailablePeriods])

  // Load budget summary when selected period changes
  useEffect(() => {
    if (selectedBudgetPeriod) {
      loadBudgetSummary(selectedBudgetPeriod)
    } else {
      loadBudgetSummary()
    }
  }, [selectedBudgetPeriod, loadBudgetSummary])

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  const handleAddCategory = () => {
    setEditingCategory(null)
    setEditingSubcategory(null)
    setIsSubcategory(false)
    setCategoryName('')
    setCategoryType('expense')
    setParentCategoryId('')
    setIsDialogOpen(true)
  }

  const handleAddSubcategory = (parentCategory: Category) => {
    setEditingCategory(null)
    setEditingSubcategory(null)
    setIsSubcategory(true)
    setCategoryName('')
    setCategoryType(parentCategory.type as 'income' | 'expense')
    setParentCategoryId(parentCategory.id)
    setIsDialogOpen(true)
  }

  const handleEdit = (item: Category | Subcategory, isSubcat: boolean) => {
    if (isSubcat) {
      setEditingSubcategory(item as Subcategory)
      setEditingCategory(null)
      setIsSubcategory(true)
      const subcategory = item as Subcategory
      const parentCategory = categories.find(cat => cat.id === subcategory.main_category_id)
      setParentCategoryId(subcategory.main_category_id)
      setCategoryType(parentCategory?.type as 'income' | 'expense' || 'expense')
    } else {
      setEditingCategory(item as Category)
      setEditingSubcategory(null)
      setIsSubcategory(false)
      setCategoryType((item as Category).type as 'income' | 'expense')
      setParentCategoryId('')
    }
    setCategoryName(item.name)
    setIsDialogOpen(true)
  }

  const handleBudgetEdit = async (subcategory: Subcategory) => {
    setBudgetEditingSubcategory(subcategory)
    
    // Load existing budget amount for the selected period from budgets table
    if (user && selectedBudgetPeriod) {
      try {
        const budget = await categoriesServiceFallback.getSubcategoryBudgetForPeriod(
          user.id,
          subcategory.id,
          selectedBudgetPeriod.startDate,
          selectedBudgetPeriod.endDate
        )
        
        const budgetAmount = budget?.budgeted_amount || 0
        setBudgetAmount(budgetAmount > 0 ? budgetAmount.toLocaleString('id-ID').replace(/,/g, '.') : '')
      } catch (err) {
        console.error('Error loading budget for period:', err)
        setBudgetAmount('')
      }
    } else {
      setBudgetAmount('')
    }
    
    setBudgetDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    try {
      if (isSubcategory) {
        if (editingSubcategory) {
          await categoriesServiceFallback.updateSubcategory(
            editingSubcategory.id,
            categoryName
          )
          toast.success('Subcategory updated successfully')
        } else {
          await categoriesServiceFallback.addSubcategory(
            user.id,
            parentCategoryId,
            categoryName
          )
          toast.success('Subcategory added successfully')
        }
      } else {
        if (editingCategory) {
          await categoriesServiceFallback.updateMainCategory(
            editingCategory.id,
            categoryName,
            categoryType
          )
          toast.success('Category updated successfully')
        } else {
          await categoriesServiceFallback.addMainCategory(
            user.id,
            categoryName,
            categoryType
          )
          toast.success('Category added successfully')
        }
      }
      
      setIsDialogOpen(false)
      await loadCategories()
      await loadBudgetSummary()
    } catch (err) {
      console.error('Error saving category:', err)
      toast.error('Failed to save category')
    }
  }

  const handleBudgetSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !budgetEditingSubcategory || !selectedBudgetPeriod) return

    try {
      const amount = parseFloat(budgetAmount.replace(/\./g, '').replace(/,/g, '.'))
      
      if (isNaN(amount) || amount < 0) {
        toast.error('Please enter a valid budget amount')
        return
      }

      // Update subcategory budget for the currently selected period using the budgets table
      await categoriesServiceFallback.updateSubcategoryBudgetForPeriod(
        user.id,
        budgetEditingSubcategory.id,
        amount,
        selectedBudgetPeriod.startDate,
        selectedBudgetPeriod.endDate,
        'monthly' // Default to monthly for now
      )
      
      toast.success('Budget updated successfully')
      setBudgetDialogOpen(false)
      await loadBudgetSummary(selectedBudgetPeriod)
      await loadCategories() // Reload categories to get updated budget amounts
    } catch (err) {
      console.error('Error saving budget:', err)
      toast.error('Failed to save budget')
    }
  }

  const handleBudgetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const numericValue = value.replace(/[^0-9]/g, '')
    
    if (numericValue === '') {
      setBudgetAmount('')
      return
    }
    
    const formattedValue = parseInt(numericValue).toLocaleString('id-ID').replace(/,/g, '.')
    setBudgetAmount(formattedValue)
  }



  const handleSelectedBudgetPeriodChange = (value: string) => {
    const period = availableBudgetPeriods.find(p => `${p.startDate}|${p.endDate}` === value)
    if (period) {
      setSelectedBudgetPeriod(period)
    }
  }

  const handleDeleteConfirm = async (item: Category | Subcategory, isSubcat: boolean) => {
    if (!user) return

    try {
      if (isSubcat) {
        await categoriesServiceFallback.deleteSubcategory(item.id)
        toast.success('Subcategory deleted successfully')
      } else {
        await categoriesServiceFallback.deleteMainCategory(item.id)
        toast.success('Category deleted successfully')
      }
      
      await loadCategories()
      await loadBudgetSummary()
    } catch (err) {
      console.error('Error deleting item:', err)
      toast.error('Failed to delete item')
    }
  }

  const handleTouchEnd = (category: CategoryWithSubcategories) => {
    setViewingCategory(category)
    setIsDetailsDialogOpen(true)
  }

  const handleSubcategoryTouchEnd = (subcategory: Subcategory) => {
    setViewingSubcategory(subcategory)
    setIsSubcategoryDetailsDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading categories...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  const expenseCategories = categories.filter(cat => cat.type === 'expense')
  const incomeCategories = categories.filter(cat => cat.type === 'income')

  const renderCategories = (categoryList: CategoryWithSubcategories[], title: string) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Button onClick={handleAddCategory} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Category
        </Button>
      </div>
      
      {categoryList.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            No {title.toLowerCase()} categories yet. Add one to get started!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {categoryList.map((category) => {
            const isExpanded = expandedCategories.has(category.id)
            // Use main category budget data for totals
            const mainCategoryBudget = budgetSummary?.mainCategories?.find(budget => budget.id === category.id)
            const totalBudget = mainCategoryBudget?.budgetAmount || 0
            const totalSpent = mainCategoryBudget?.spent || 0
            const totalLeftover = totalBudget - totalSpent
            
            // Helper function to format currency with thousand separators
            const formatCurrency = (amount: number) => {
              return `Rp ${Math.abs(amount).toLocaleString('id-ID')}`
            }
            
            return (
              <Card key={category.id} className="overflow-hidden">
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleTouchEnd(category)}
                  onTouchEnd={() => handleTouchEnd(category)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleCategory(category.id)
                        }}
                        className="p-1 h-auto"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <div>
                        <h3 className="font-medium">{category.name}</h3>
                        <p className="text-sm text-gray-600">
                          {category.subcategories?.length || 0} subcategories
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {totalBudget > 0 && (
                        <div className="text-right min-w-[120px]">
                          <div className="text-sm font-medium text-gray-700">
                            {formatCurrency(totalBudget)}
                          </div>
                          <div className={`text-xs font-semibold ${
                            totalLeftover >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {totalLeftover >= 0 ? '✓ ' : '⚠ '}
                            {formatCurrency(totalLeftover)}
                            {totalLeftover >= 0 ? ' left' : ' over'}
                          </div>
                        </div>
                      )}
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            •••
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            handleEdit(category as any, false)
                          }}>
                            Edit Category
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            handleAddSubcategory(category as any)
                          }}>
                            Add Subcategory
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteConfirm(category as any, false)
                            }}
                            className="text-red-600"
                          >
                            Delete Category
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
                
                {isExpanded && category.subcategories && category.subcategories.length > 0 && (
                  <div className="border-t bg-gray-50">
                    <div className="p-4 space-y-2">
                      {category.subcategories.map((subcategory) => {
                        const subBudget = budgetSummary?.categories?.find(budget => budget.id === subcategory.id)
                        const budgetAmount = subBudget?.budgetAmount || 0
                        const spent = subBudget?.spent || 0
                        const leftover = budgetAmount - spent
                        
                        return (
                          <div 
                            key={subcategory.id} 
                            className="flex items-center justify-between p-3 bg-white rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => handleSubcategoryTouchEnd(subcategory)}
                            onContextMenu={(e) => {
                              e.preventDefault()
                              handleEdit(subcategory, true)
                            }}
                            onTouchStart={(e) => {
                              const touch = e.touches[0]
                              const startTime = Date.now()
                              const startX = touch.clientX
                              const startY = touch.clientY
                              
                              const handleTouchEnd = (endEvent: TouchEvent) => {
                                const endTime = Date.now()
                                const endTouch = endEvent.changedTouches[0]
                                const endX = endTouch.clientX
                                const endY = endTouch.clientY
                                
                                const distance = Math.sqrt(
                                  Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
                                )
                                const duration = endTime - startTime
                                
                                if (duration > 500 && distance < 10) {
                                  e.preventDefault()
                                  handleEdit(subcategory, true)
                                } else if (duration < 500 && distance < 10) {
                                  handleSubcategoryTouchEnd(subcategory)
                                }
                                
                                document.removeEventListener('touchend', handleTouchEnd)
                              }
                              
                              document.addEventListener('touchend', handleTouchEnd)
                            }}
                          >
                            <div className="flex-1">
                              <div className="font-medium">{subcategory.name}</div>
                              {budgetAmount > 0 && (
                                <div className="text-sm text-gray-600">
                                  Budget: {formatCurrency(budgetAmount)}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {(budgetAmount > 0 || spent > 0) && (
                                <div className="text-right">
                                  <div className={`text-sm font-semibold ${
                                    leftover >= 0 ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {leftover >= 0 ? '✓ ' : '⚠ '}
                                    {formatCurrency(leftover)}
                                    {leftover >= 0 ? ' left' : ' over'}
                                  </div>
                                </div>
                              )}
                              
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleBudgetEdit(subcategory)
                                }}
                              >
                                Budget
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          {currentPeriodDescription && (
            <p className="text-sm text-gray-600 mt-1">
              Current Period: {currentPeriodDescription}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          {/* Budget Period Selector */}
          <div className="flex items-center space-x-2">
            <Label className="text-sm font-medium">Period:</Label>
            <Select 
              value={selectedBudgetPeriod ? `${selectedBudgetPeriod.startDate}|${selectedBudgetPeriod.endDate}` : ''} 
              onValueChange={handleSelectedBudgetPeriodChange}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {availableBudgetPeriods.map((period) => (
                  <SelectItem key={`${period.startDate}|${period.endDate}`} value={`${period.startDate}|${period.endDate}`}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleAddCategory}>
               <Plus className="w-4 h-4 mr-2" />
               Add Category
             </DropdownMenuItem>
             <DropdownMenuItem onClick={() => {
                // For subcategory, we need a parent category - show dialog to select one
                const firstExpenseCategory = categories.find(cat => cat.type === 'expense')
                if (firstExpenseCategory) {
                  handleAddSubcategory(firstExpenseCategory as any)
                } else {
                  toast.error('Please create a main category first')
                }
              }}>
               <Plus className="w-4 h-4 mr-2" />
               Add Subcategory
             </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {budgetSummary && (
        <Card className="py-2">
          <CardHeader className="pb-1 px-3">
            <CardTitle className="text-base">Budget Overview</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-2 px-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-medium text-gray-600">Total Budget</Label>
                <p className="text-lg font-bold">
                  Rp {budgetSummary.totalBudget.toLocaleString('id-ID').replace(/,/g, '.')}
                </p>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Total Spent</Label>
                <p className="text-lg font-bold">
                  Rp {budgetSummary.totalSpent.toLocaleString('id-ID').replace(/,/g, '.')}
                </p>
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-600">Remaining</Label>
                <p className={`text-lg font-bold ${
                  (budgetSummary.totalBudget - budgetSummary.totalSpent) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Rp {(budgetSummary.totalBudget - budgetSummary.totalSpent).toLocaleString('id-ID').replace(/,/g, '.')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {renderCategories(expenseCategories, 'Expense Categories')}
      {renderCategories(incomeCategories, 'Income Categories')}

      {/* Add/Edit Category Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory || editingSubcategory ? 'Edit' : 'Add'} {isSubcategory ? 'Subcategory' : 'Category'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="categoryName">{isSubcategory ? 'Subcategory' : 'Category'} Name</Label>
              <Input
                id="categoryName"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder={`Enter ${isSubcategory ? 'subcategory' : 'category'} name`}
                required
              />
            </div>
            
            {!isSubcategory && (
              <div>
                <Label htmlFor="categoryType">Type</Label>
                <Select value={categoryType} onValueChange={(value: 'income' | 'expense') => setCategoryType(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {isSubcategory && (
              <div>
                <Label htmlFor="parentCategory">Parent Category</Label>
                <Select value={parentCategoryId} onValueChange={setParentCategoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter(cat => cat.type === categoryType)
                      .map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {editingCategory || editingSubcategory ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Category Details</DialogTitle>
          </DialogHeader>
          {viewingCategory && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div>
                  <h3 className="font-semibold text-lg">{viewingCategory.name}</h3>
                  <p className="text-sm text-gray-600">
                    {viewingCategory.type === 'expense' ? 'Expense' : 'Income'} • {viewingCategory.subcategories?.length || 0} subcategories
                  </p>
                </div>
              </div>
              
              {(() => {
                // Use main category budget data for dialog display
                const mainCategoryBudget = budgetSummary?.mainCategories?.find(budget => budget.id === viewingCategory.id)
                const totalBudget = mainCategoryBudget?.budgetAmount || 0
                const totalSpent = mainCategoryBudget?.spent || 0
                const totalLeftover = totalBudget - totalSpent
                
                // Helper function to format currency with thousand separators
                const formatCurrency = (amount: number) => {
                  return `Rp ${Math.abs(amount).toLocaleString('id-ID')}`
                }
                
                return totalBudget > 0 ? (
                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Total Budget</Label>
                      <p className="text-lg font-bold">{formatCurrency(totalBudget)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Spent</Label>
                      <p className="text-lg font-bold">{formatCurrency(totalSpent)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Remaining</Label>
                      <p className={`text-lg font-bold ${totalLeftover >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(totalLeftover)}
                      </p>
                    </div>
                  </div>
                ) : null
              })()} 
              
              {viewingCategory.subcategories && viewingCategory.subcategories.length > 0 && (
                <div>
                  <Label className="text-sm font-medium text-gray-600 mb-2 block">Subcategories</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {viewingCategory.subcategories.map((subcategory) => {
                      const subBudget = budgetSummary?.categories?.find(budget => budget.id === subcategory.id)
                      const budgetAmount = subBudget?.budgetAmount || 0
                      const spent = subBudget?.spent || 0
                      const leftover = budgetAmount - spent
                      
                      // Helper function to format currency with thousand separators
                      const formatCurrency = (amount: number) => {
                        return `Rp ${Math.abs(amount).toLocaleString('id-ID')}`
                      }
                      
                      return (
                        <Card key={subcategory.id} className="p-3">
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <p className="font-medium">{subcategory.name}</p>
                              {budgetAmount > 0 && (
                                <p className="text-sm text-gray-600">
                                  Budget: {formatCurrency(budgetAmount)}
                                </p>
                              )}
                            </div>
                            {(budgetAmount > 0 || spent > 0) && (
                              <div className="text-right">
                                <div className={`text-sm font-semibold ${
                                  leftover >= 0 ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {leftover >= 0 ? '✓ ' : '⚠ '}
                                  {formatCurrency(leftover)}
                                  {leftover >= 0 ? ' left' : ' over'}
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setIsDetailsDialogOpen(false)
                  handleEdit(viewingCategory as any, false)
                }}>
                  Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Subcategory Details Dialog */}
      <Dialog open={isSubcategoryDetailsDialogOpen} onOpenChange={setIsSubcategoryDetailsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Subcategory Details</DialogTitle>
          </DialogHeader>
          {viewingSubcategory && (() => {
            const parentCategory = categories.find(cat => cat.id === viewingSubcategory.main_category_id)
            const subBudget = budgetSummary?.categories?.find(budget => budget.id === viewingSubcategory.id)
            const budgetAmount = subBudget?.budgetAmount || 0
            const spent = subBudget?.spent || 0
            const leftover = budgetAmount - spent
            
            // Helper function to format currency with thousand separators
            const formatCurrency = (amount: number) => {
              return `Rp ${Math.abs(amount).toLocaleString('id-ID')}`
            }
            
            return (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div>
                    <h3 className="font-semibold text-lg">{viewingSubcategory.name}</h3>
                    <p className="text-sm text-gray-600">
                      Parent: {parentCategory?.name || 'Unknown Category'}
                    </p>
                  </div>
                </div>
                
                {budgetAmount > 0 && (
                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Budget</Label>
                      <p className="text-lg font-bold">{formatCurrency(budgetAmount)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Spent</Label>
                      <p className="text-lg font-bold">{formatCurrency(spent)}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">Remaining</Label>
                      <p className={`text-lg font-bold ${leftover >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(leftover)}
                      </p>
                    </div>
                  </div>
                )}
                
                {budgetAmount === 0 && (
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-sm text-yellow-800">
                      No budget set for this subcategory. Click "Manage Budget" to set one.
                    </p>
                  </div>
                )}
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button variant="outline" onClick={() => setIsSubcategoryDetailsDialogOpen(false)}>
                    Close
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setIsSubcategoryDetailsDialogOpen(false)
                    handleBudgetEdit(viewingSubcategory)
                  }}>
                    Manage Budget
                  </Button>
                  <Button onClick={() => {
                    setIsSubcategoryDetailsDialogOpen(false)
                    handleEdit(viewingSubcategory, true)
                  }}>
                    Edit
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Budget Management Dialog */}
      <Dialog open={budgetDialogOpen} onOpenChange={setBudgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Budget - {budgetEditingSubcategory?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBudgetSubmit} className="space-y-4">
            <div>
              <Label htmlFor="budgetAmount">Budget Amount</Label>
              <Input
                 id="budgetAmount"
                 type="text"
                 value={budgetAmount}
                 onChange={handleBudgetAmountChange}
                 placeholder="Enter budget amount"
                 required
               />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setBudgetDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Budget</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}