'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu'

import { toast } from 'sonner'
import { Plus, ChevronDown, Target } from 'lucide-react'
import { categoriesService } from '../services/categories-service'
import { transactionService } from '../services/transaction-service'
import type { Category } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'


const budgetPeriods = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: '10days', label: '10 Days' }
]

export function CategoriesPage() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [budgetSummary, setBudgetSummary] = useState<Array<{id: string, budgetAmount: number, spent: number, remaining: number}>>([])
  const [categoryTotals, setCategoryTotals] = useState<Record<string, { income: number; expense: number; type: 'income' | 'expense'; count: number }>>({})
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'add-category' | 'add-subcategory' | 'edit'>('add-category')
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  // Helper function to format currency with thousand separators
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID').format(amount);
  };

  // Helper function to format input value with thousand separators
  const formatInputValue = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '');
    if (!numericValue) return '';
    return new Intl.NumberFormat('id-ID').format(parseInt(numericValue));
  };

  // Helper function to parse formatted input back to number
  const parseInputValue = (value: string) => {
    return value.replace(/[^0-9]/g, '');
  };
  
  // Form state
  const [name, setName] = useState('')
  const [, setSubCategoryName] = useState('')
  const [selectedParentCategory, setSelectedParentCategory] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetPeriod, setBudgetPeriod] = useState<'monthly' | 'weekly' | '10days'>('monthly')
  const [status, setStatus] = useState<boolean>(true) // true = active, false = inactive
  
  const [selectedPeriod] = useState<'monthly' | 'weekly' | '10days'>('monthly')

  const loadCategories = useCallback(async () => {
    if (!user) return
    
    setLoading(true)
    
    // Load all categories directly from the categories table
    // This ensures we get both main categories and sub-categories
    const { data, error } = await categoriesService.getCategories(user.id)
    
    if (error) {
      console.error('Error loading categories:', error)
      toast.error('Failed to load categories', { duration: 1000 })
      setCategories([])
    } else {
      if (!data || data.length === 0) {
        console.log('No categories found, will show empty state')
        setCategories([])
      } else {
        console.log('Raw categories from database:', data)
        
        // Process categories to show hierarchy in names
        const processedCategories = await Promise.all(
          (data || []).map(async (category) => {
            if (category.parent_id) {
              // For sub-categories, find parent name and create full path
              const parentCategory = data?.find(cat => cat.id === category.parent_id)
              if (parentCategory) {
                return {
                  ...category,
                  name: `${parentCategory.name} > ${category.name}`
                }
              }
            }
            return category
          })
        )
        
        console.log('Processed categories:', processedCategories)
        setCategories(processedCategories)
      }
    }
    
    setLoading(false)
  }, [user])

  const loadBudgetSummary = useCallback(async () => {
    if (!user) return
    
    const { data, error } = await categoriesService.getBudgetSummary(user.id, selectedPeriod)
    
    if (error) {
      console.error('Error loading budget summary:', error)
    } else {
      // Transform the data to match the expected structure
      const transformedData = (data || []).map((item: {type?: string; total_budget?: number}) => ({
        id: item.type || '',
        budgetAmount: item.total_budget || 0,
        spent: 0,
        remaining: item.total_budget || 0
      }))
      setBudgetSummary(transformedData)
    }
  }, [user, selectedPeriod])

  const loadCategoryTotals = useCallback(async () => {
    if (!user) {
      console.log('[CATEGORIES DEBUG] No user, skipping category totals load')
      return
    }
    
    try {
      console.log('[CATEGORIES DEBUG] Loading category totals for user:', user.id)
      const totals = await transactionService.getCategoryTotals()
      console.log('[CATEGORIES DEBUG] Raw totals from service:', totals)
      
      // Keep original totals for individual categories (both main and sub)
      // Also create aggregated totals for main categories that include their subcategories
      const aggregatedTotals: Record<string, { income: number; expense: number; type: 'income' | 'expense'; count: number }> = {}
      
      // First, copy all direct category totals
      Object.entries(totals).forEach(([categoryId, total]) => {
        aggregatedTotals[categoryId] = { ...total }
        console.log(`[CATEGORIES DEBUG] Direct total for ${categoryId}:`, total)
      })
      
      console.log('[CATEGORIES DEBUG] Available categories for aggregation:', categories.map(c => ({ id: c.id, name: c.name, parent_id: c.parent_id, type: c.type, budget_amount: c.budget_amount })))
      
      // Then, for main categories, add their subcategories' totals
      categories.forEach(category => {
        if (!category.parent_id) {
          // This is a main category, find all its subcategories and add their totals
          const subcategories = categories.filter(c => c.parent_id === category.id)
          console.log(`[CATEGORIES DEBUG] Main category ${category.name} (${category.id}) has subcategories:`, subcategories.map(s => s.name))
          
          // Initialize main category totals if it doesn't exist and has subcategories
          if (subcategories.length > 0 && !aggregatedTotals[category.id]) {
            aggregatedTotals[category.id] = {
              income: 0,
              expense: 0,
              type: category.type,
              count: 0
            }
            console.log(`[CATEGORIES DEBUG] Initialized main category ${category.name} totals`)
          }
          
          subcategories.forEach(subcategory => {
            const subcategoryTotal = totals[subcategory.id]
            console.log(`[CATEGORIES DEBUG] Subcategory ${subcategory.name} (${subcategory.id}) total:`, subcategoryTotal)
            if (subcategoryTotal) {
              // Ensure main category entry exists
              if (!aggregatedTotals[category.id]) {
                aggregatedTotals[category.id] = {
                  income: 0,
                  expense: 0,
                  type: category.type,
                  count: 0
                }
                console.log(`[CATEGORIES DEBUG] Created main category ${category.name} entry for subcategory aggregation`)
              }
              aggregatedTotals[category.id].income += subcategoryTotal.income
              aggregatedTotals[category.id].expense += subcategoryTotal.expense
              aggregatedTotals[category.id].count += subcategoryTotal.count
              console.log(`[CATEGORIES DEBUG] Added subcategory ${subcategory.name} totals to main category ${category.name}. New totals:`, aggregatedTotals[category.id])
            }
          })
        }
      })
      
      console.log('[CATEGORIES DEBUG] Final aggregated totals:', aggregatedTotals)
      setCategoryTotals(aggregatedTotals)
    } catch (error) {
      console.error('[CATEGORIES DEBUG] Error loading category totals:', error)
    }
  }, [user, categories])

  useEffect(() => {
    if (user) {
      loadCategories()
      loadBudgetSummary()
      loadCategoryTotals()
    }
  }, [user, loadCategories, loadBudgetSummary, loadCategoryTotals])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user || !name.trim()) {
      toast.error('Please fill in all required fields', { duration: 1000 })
      return
    }

    const budgetAmountNum = parseInt(budgetAmount, 10) || 0
    
    const categoryData = {
      user_id: user.id,
      name: name.trim(),
      type,

      budget_amount: budgetAmountNum,
      budget_period: budgetPeriod,
      is_active: status
    }

    if (editingCategory) {
      const { data, error } = await categoriesService.updateCategory(editingCategory.id, {
        name: categoryData.name,
        type: categoryData.type,

        budget_amount: categoryData.budget_amount,
        budget_period: categoryData.budget_period,
        is_active: categoryData.is_active
      })
      
      if (error) {
        console.error('Error updating category:', error)
        toast.error('Failed to update category', { duration: 1000 })
      } else {
        toast.success('Category updated successfully', { duration: 1000 })
        setCategories(prev => prev.map(cat => cat.id === editingCategory.id ? data! : cat))
        handleDialogClose()
        loadBudgetSummary()
      }
    } else {
      if (dialogMode === 'add-category') {
        // Create main category without budget
        const mainCategoryData = {
           user_id: user!.id,
           name: name.trim(),
           type,

           budget_amount: 0, // No budget for main categories
           budget_period: 'monthly' as const,
           is_active: true
         }
        
        const { data, error } = await categoriesService.addCategory(mainCategoryData)
        
        if (error) {
          console.error('Error adding category:', error)
          if ((error as {code?: string; message?: string}).code === 'DUPLICATE_CATEGORY') {
            toast.error((error as {message?: string}).message || 'Duplicate category', { duration: 1000 })
          } else {
            toast.error('Failed to add category', { duration: 1000 })
          }
        } else {
          toast.success('Category added successfully', { duration: 1000 })
          setCategories(prev => [data!, ...prev])
          handleDialogClose()
          loadBudgetSummary()
        }
      } else if (dialogMode === 'add-subcategory') {
        // Create sub-category with budget under selected parent
        if (!selectedParentCategory) {
          toast.error('Please select a parent category', { duration: 1000 })
          return
        }
        
        const subCategoryData = {
           user_id: user!.id,
           name: name.trim(),
           type,

           budget_amount: budgetAmount ? parseFloat(budgetAmount) : 0,
           budget_period: budgetPeriod,
           is_active: true,
           parent_id: selectedParentCategory
         } as Omit<Category, 'id' | 'created_at' | 'updated_at'>
        
        const { data, error } = await categoriesService.addCategory(subCategoryData)
        
        if (error) {
          console.error('Error adding sub-category:', error)
          if ((error as {code?: string; message?: string}).code === 'DUPLICATE_CATEGORY') {
            toast.error((error as {message?: string}).message || 'Duplicate category', { duration: 1000 })
          } else {
            toast.error('Failed to add sub-category', { duration: 1000 })
          }
        } else {
          const parentCategory = categories.find(cat => cat.id === selectedParentCategory)
          toast.success(`Sub-category "${name.trim()}" added successfully under "${parentCategory?.name}"`, { duration: 1000 })
          setCategories(prev => [data!, ...prev])
          handleDialogClose()
          loadBudgetSummary()
        }
      }
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setName(category.name)
    setSubCategoryName('') // Will be updated when we load parent/child relationships
    setType(category.type)
    setBudgetAmount(category.budget_amount.toString())
    setBudgetPeriod(category.budget_period)
    setStatus(category.is_active)
    setIsDialogOpen(true)
  }

  const handleDelete = (category: Category) => {
    setCategoryToDelete(category)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!categoryToDelete) return
    
    const { error } = await categoriesService.deleteCategory(categoryToDelete.id)
    
    if (error) {
      console.error('Error deleting category:', error)
      toast.error('Failed to delete category', { duration: 1000 })
    } else {
      toast.success('Category deleted successfully', { duration: 1000 })
      setCategories(prev => prev.filter(cat => cat.id !== categoryToDelete.id))
      loadBudgetSummary()
    }
    setIsDeleteDialogOpen(false)
    setCategoryToDelete(null)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setDialogMode('add-category')
    setEditingCategory(null)
    setName('')
    setSubCategoryName('')
    setSelectedParentCategory('')
    setType('expense')
    setBudgetAmount('')
    setBudgetPeriod('monthly')
    setStatus(true)
  }

  const openAddCategoryDialog = () => {
    setDialogMode('add-category')
    setIsDialogOpen(true)
  }

  const openAddSubCategoryDialog = () => {
    setDialogMode('add-subcategory')
    setIsDialogOpen(true)
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-48 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Category</h1>
        </div>
      </div>
      

      
      <div className="px-6 pt-6">
         <div className="flex justify-end mb-4">
           <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <Button>
                 <Plus className="w-4 h-4 mr-2" />
                 Add
                 <ChevronDown className="w-4 h-4 ml-2" />
               </Button>
             </DropdownMenuTrigger>
             <DropdownMenuContent align="end">
               <DropdownMenuItem onClick={openAddCategoryDialog}>
                 <Plus className="w-4 h-4 mr-2" />
                 Add Category
               </DropdownMenuItem>
               <DropdownMenuItem onClick={openAddSubCategoryDialog}>
                 <Plus className="w-4 h-4 mr-2" />
                 Add Sub Category
               </DropdownMenuItem>
             </DropdownMenuContent>
           </DropdownMenu>
           
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? 'Edit Category' : 
                   dialogMode === 'add-category' ? 'Add New Category' : 'Add New Sub Category'}
                </DialogTitle>
                <DialogDescription>
                  {editingCategory ? 'Update category details' : 
                   dialogMode === 'add-category' ? 'Create a new main category' : 'Create a new sub-category under an existing category'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {dialogMode === 'add-subcategory' && (
                  <div className="space-y-2">
                    <Label htmlFor="parent-category">Parent Category</Label>
                    <Select value={selectedParentCategory} onValueChange={setSelectedParentCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories
                           .filter(cat => !cat.parent_id) // Only show main categories
                           .map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="space-y-1">
                  <Label htmlFor="name">
                    {dialogMode === 'add-subcategory' ? 'Sub Category Name' : 'Category Name'}
                  </Label>
                  <Input
                    id="name"
                    placeholder={dialogMode === 'add-subcategory' ? 'Enter sub category name' : 'Enter category name'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                
                {/* Budget fields only for sub-categories or when editing */}
                {(dialogMode === 'add-subcategory' || editingCategory) && type === 'expense' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="budget">Budget Amount (IDR)</Label>
                      <Input
                        id="budget"
                        type="text"
                        placeholder="0"
                        value={budgetAmount ? formatInputValue(budgetAmount) : ''}
                        onChange={(e) => {
                          const rawValue = parseInputValue(e.target.value);
                          setBudgetAmount(rawValue);
                        }}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Budget Period</Label>
                      <Select value={budgetPeriod} onValueChange={(value: 'monthly' | 'weekly' | '10days') => setBudgetPeriod(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {budgetPeriods.map((period) => (
                            <SelectItem key={period.value} value={period.value}>
                              {period.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status ? 'active' : 'inactive'} onValueChange={(value) => setStatus(value === 'active')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex space-x-2 pt-4">
                   <Button type="button" variant="outline" onClick={handleDialogClose} className="flex-1">
                     Cancel
                   </Button>
                   {editingCategory && (
                     <Button 
                     type="button" 
                     variant="destructive" 
                     onClick={() => {
                       handleDelete(editingCategory)
                       handleDialogClose()
                     }} 
                     className="flex-1"
                   >
                     Delete
                   </Button>
                   )}
                   <Button type="submit" className="flex-1">
                     {editingCategory ? 'Update' : 'Add'} Category
                   </Button>
                 </div>
              </form>
            </DialogContent>
           </Dialog>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Category</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the category &quot;{categoryToDelete?.name}&quot;? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      
      <div className="px-6 space-y-2">
        {/* Categories Cards */}
        {categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No categories found</p>
            <p className="text-sm">Add your first category above</p>
          </div>
        ) : (
          <div className="grid gap-1">
            {categories.map((category) => {
              const budgetData = budgetSummary.find(budget => budget.id === category.id)
              const categoryTotal = categoryTotals[category.id]
              
              console.log(`[CATEGORIES DEBUG] Rendering category ${category.name}:`, {
                categoryId: category.id,
                categoryType: category.type,
                budgetAmount: category.budget_amount,
                categoryTotal,
                budgetData,
                hasTotal: !!categoryTotal,
                hasBudget: category.budget_amount !== null && category.budget_amount !== undefined
              })

              
              return (
                 <Card key={category.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleEdit(category)}>
                   <CardContent className="p-1.5">
                     <div>
                       <div className="flex items-center gap-2">
                         <h3 className="font-semibold text-sm">{category.name}</h3>
                         {category.parent_id && (
                           <Badge variant="secondary" className="text-xs px-1 py-0">Sub</Badge>
                         )}
                       </div>
                       
                       {/* Show total income for income categories */}
                       {category.type === 'income' && categoryTotal && (
                         <div className="mt-0.5 space-y-0.5">
                           <div className="flex justify-between text-xs">
                             <span className="text-gray-600">Total Income</span>
                             <span className="font-medium text-green-600">IDR {formatCurrency(categoryTotal.income)}</span>
                           </div>
                           <div className="flex justify-between text-xs">
                             <span className="text-gray-600">Transactions</span>
                             <span className="font-medium text-gray-700">{categoryTotal.count}</span>
                           </div>
                         </div>
                       )}
                       
                       {/* Show budget info for expense categories with budget */}
                       {category.type === 'expense' && category.budget_amount >= 0 && (
                         <div className="mt-0.5 space-y-0.5">
                           <div className="flex justify-between text-xs">
                             <span className="text-gray-600">Budget ({category.budget_period})</span>
                             <span className="font-medium">IDR {formatCurrency(category.budget_amount)}</span>
                           </div>
                           {budgetData && (
                             <div className="flex justify-between text-xs">
                               <span className="text-gray-600">Remaining</span>
                               <span className={`font-medium ${
                                 budgetData.remaining >= 0 ? 'text-green-600' : 'text-red-600'
                               }`}>
                                 IDR {formatCurrency(Math.abs(budgetData.remaining))} {budgetData.remaining >= 0 ? 'left' : 'over'}
                               </span>
                             </div>
                           )}
                         </div>
                       )}
                       
                       {/* Show total expense for expense categories without budget */}
                       {category.type === 'expense' && category.budget_amount === null && categoryTotal && (
                         <div className="mt-0.5 space-y-0.5">
                           <div className="flex justify-between text-xs">
                             <span className="text-gray-600">Total Expense</span>
                             <span className="font-medium text-red-600">IDR {formatCurrency(categoryTotal.expense)}</span>
                           </div>
                           <div className="flex justify-between text-xs">
                             <span className="text-gray-600">Transactions</span>
                             <span className="font-medium text-gray-700">{categoryTotal.count}</span>
                           </div>
                         </div>
                       )}
                     </div>
                   </CardContent>
                 </Card>
               )
            })}
          </div>
        )}
      </div>
    </div>
  )
}