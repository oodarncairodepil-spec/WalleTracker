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
import { Plus, Trash2, ChevronDown, ChevronRight, ChevronsUpDown, Edit, MoreVertical } from 'lucide-react'
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

  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false)
  const [budgetEditingSubcategory, setBudgetEditingSubcategory] = useState<Subcategory | null>(null)
  const [budgetAmount, setBudgetAmount] = useState('')

  const [availableBudgetPeriods, setAvailableBudgetPeriods] = useState<Array<{startDate: string, endDate: string, label: string}>>([])
  const [selectedBudgetPeriod, setSelectedBudgetPeriod] = useState<{startDate: string, endDate: string, label: string} | null>(null)
  const [currentPeriodDescription, setCurrentPeriodDescription] = useState('')
  const [isSubcategoryDetailsDialogOpen, setIsSubcategoryDetailsDialogOpen] = useState(false)
  const [viewingSubcategory, setViewingSubcategory] = useState<Subcategory | null>(null)
  
  // Context menu state
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const [contextMenuCategory, setContextMenuCategory] = useState<CategoryWithSubcategories | null>(null)
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  
  // Delete confirmation dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryWithSubcategories | null>(null)

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

  // Cleanup long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer)
      }
    }
  }, [longPressTimer])

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



  const handleSubcategoryTouchEnd = (subcategory: Subcategory) => {
    setViewingSubcategory(subcategory)
    setIsSubcategoryDetailsDialogOpen(true)
  }

  // Long press handlers for category context menu
  const handleCategoryLongPressStart = (category: CategoryWithSubcategories, e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const timer = setTimeout(() => {
      setContextMenuCategory(category)
      setContextMenuOpen(true)
    }, 500) // 500ms long press
    setLongPressTimer(timer)
  }

  const handleCategoryLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  const handleEditCategory = (category: CategoryWithSubcategories) => {
    setEditingCategory(category as unknown as Category)
    setIsSubcategory(false)
    setCategoryName(category.name)
    setCategoryType(category.type)
    setIsDialogOpen(true)
    setContextMenuOpen(false)
  }

  const handleDeleteCategory = (category: CategoryWithSubcategories) => {
    setCategoryToDelete(category)
    setDeleteConfirmOpen(true)
    setContextMenuOpen(false)
  }

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return
    
    try {
      await categoriesServiceFallback.deleteMainCategory(categoryToDelete.id)
      toast.success('Category deleted successfully')
      await loadCategories()
      await loadBudgetSummary()
    } catch (err) {
      console.error('Error deleting category:', err)
      toast.error('Failed to delete category')
    }
    
    setDeleteConfirmOpen(false)
    setCategoryToDelete(null)
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
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
              <Card 
                key={category.id} 
                className="overflow-hidden cursor-pointer hover:bg-gray-50 transition-colors relative" 
                onClick={() => toggleCategory(category.id)}
                onTouchStart={(e) => handleCategoryLongPressStart(category, e)}
                onTouchEnd={handleCategoryLongPressEnd}
                onMouseDown={(e) => handleCategoryLongPressStart(category, e)}
                onMouseUp={handleCategoryLongPressEnd}
                onMouseLeave={handleCategoryLongPressEnd}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      {category.subcategories && category.subcategories.length > 0 && (
                        <div className="p-1 h-auto">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </div>
                      )}
                      <div>
                        <h3 className="font-medium">{category.name}</h3>
                        <p className="text-sm text-gray-600">
                          {category.subcategories?.length || 0} subcategories
                        </p>
                      </div>
                    </div>
                    
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
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSubcategoryTouchEnd(subcategory)
                            }}
                            onTouchStart={(e) => e.stopPropagation()}
                            onTouchEnd={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onMouseUp={(e) => e.stopPropagation()}
                            onMouseLeave={(e) => e.stopPropagation()}
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
        </div>
      </div>
      
      {/* Budget Period Selector - moved below Categories heading */}
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



      {/* Subcategory Details Dialog */}
      <Dialog open={isSubcategoryDetailsDialogOpen} onOpenChange={setIsSubcategoryDetailsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-lg mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Subcategory Details</DialogTitle>
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center sm:text-left">
                      <Label className="text-sm font-medium text-gray-600">Budget</Label>
                      <p className="text-lg font-bold">{formatCurrency(budgetAmount)}</p>
                    </div>
                    <div className="text-center sm:text-left">
                      <Label className="text-sm font-medium text-gray-600">Spent</Label>
                      <p className="text-lg font-bold">{formatCurrency(spent)}</p>
                    </div>
                    <div className="text-center sm:text-left">
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
                
                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsSubcategoryDetailsDialogOpen(false)}
                    className="w-full sm:w-auto"
                  >
                    Close
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsSubcategoryDetailsDialogOpen(false)
                      handleBudgetEdit(viewingSubcategory)
                    }}
                    className="w-full sm:w-auto"
                  >
                    Manage Budget
                  </Button>
                  <Button 
                    onClick={() => {
                      setIsSubcategoryDetailsDialogOpen(false)
                      handleEdit(viewingSubcategory, true)
                    }}
                    className="w-full sm:w-auto"
                  >
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

      {/* Category Context Menu */}
      <Dialog open={contextMenuOpen} onOpenChange={setContextMenuOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Category Options</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => contextMenuCategory && handleEditCategory(contextMenuCategory)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Category
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => contextMenuCategory && handleDeleteCategory(contextMenuCategory)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Category
            </Button>
          </div>
        </DialogContent>
       </Dialog>

       {/* Delete Confirmation Dialog */}
       <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle>Delete Category</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <p className="text-sm text-gray-600">
               Are you sure you want to delete <strong>"{categoryToDelete?.name}"</strong>?
             </p>
             <p className="text-sm text-red-600">
               This will also delete all its subcategories and associated budgets. This action cannot be undone.
             </p>
             <div className="flex justify-end space-x-2">
               <Button
                 variant="outline"
                 onClick={() => setDeleteConfirmOpen(false)}
               >
                 Cancel
               </Button>
               <Button
                 variant="destructive"
                 onClick={confirmDeleteCategory}
               >
                 Delete
               </Button>
             </div>
           </div>
         </DialogContent>
       </Dialog>
     </div>
   )
 }