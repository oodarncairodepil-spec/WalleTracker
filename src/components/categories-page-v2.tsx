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
import { useAuth } from '../contexts/auth-context'

export function CategoriesPageV2() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<CategoryWithSubcategories[]>([])
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<'add-main' | 'add-sub' | 'edit-main' | 'edit-sub'>('add-main')
  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [selectedMainCategoryId, setSelectedMainCategoryId] = useState('')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [budgetPeriod, setBudgetPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly')
  const [editingItem, setEditingItem] = useState<CategoryItem | CategoryWithSubcategories | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<{item: CategoryItem, isSubcategory: boolean} | null>(null)

  const loadCategories = useCallback(async () => {
    if (!user) return
    setLoading(true)
    
    try {
      const data = await categoriesServiceFallback.getMainCategories(user.id)
      setCategories(data || [])
    } catch (error) {
      console.error('Error loading categories:', error)
      toast.error('Failed to load categories')
      setCategories([])
    }
    
    setLoading(false)
  }, [user])

  const loadBudgetSummary = useCallback(async () => {
    if (!user) return
    
    try {
      const data = await categoriesServiceFallback.getBudgetSummary(user.id)
      setBudgetSummary(data)
    } catch (error) {
      console.error('Error loading budget summary:', error)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadCategories()
      loadBudgetSummary()
    }
  }, [user, loadCategories, loadBudgetSummary])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !name.trim()) return

    const budgetAmountNum = budgetAmount ? parseInt(budgetAmount) : 0

    try {
      if (dialogMode === 'add-main') {
        await categoriesServiceFallback.addMainCategory(user.id, name.trim(), type)
        toast.success('Main category added successfully')
      } else if (dialogMode === 'add-sub') {
        if (!selectedMainCategoryId) {
          toast.error('Please select a main category')
          return
        }
        await categoriesServiceFallback.addSubcategory(
          user.id,
          selectedMainCategoryId,
          name.trim(),
          budgetAmountNum,
          budgetPeriod
        )
        toast.success('Subcategory added successfully')
      } else if (dialogMode === 'edit-main' && editingItem) {
        await categoriesServiceFallback.updateMainCategory(editingItem.id, name.trim(), type)
        toast.success('Main category updated successfully')
      } else if (dialogMode === 'edit-sub' && editingItem) {
        await categoriesServiceFallback.updateSubcategory(
          editingItem.id,
          name.trim(),
          budgetAmountNum,
          budgetPeriod
        )
        toast.success('Subcategory updated successfully')
      }
      
      loadCategories()
      loadBudgetSummary()
      handleDialogClose()
    } catch (error) {
      console.error('Error:', error)
      toast.error('Failed to save category')
    }
  }

  const handleEdit = (item: CategoryItem | CategoryWithSubcategories, isSubcategory: boolean) => {
    setEditingItem(item)
    setName(item.name)
    setType(item.type || 'expense')
    setBudgetAmount('budgetAmount' in item ? item.budgetAmount?.toString() || '' : '')
    setBudgetPeriod('budgetPeriod' in item ? item.budgetPeriod || 'monthly' : 'monthly')
    setDialogMode(isSubcategory ? 'edit-sub' : 'edit-main')
    setDialogOpen(true)
  }

  const handleDeleteConfirm = (item: any, isSubcategory: boolean) => {
    setItemToDelete({ item, isSubcategory })
    setDeleteConfirmOpen(true)
  }

  const handleDelete = async () => {
    if (!user || !itemToDelete) return
    
    try {
      if (itemToDelete.isSubcategory) {
        await categoriesServiceFallback.deleteSubcategory(itemToDelete.item.id)
        toast.success('Subcategory deleted successfully')
      } else {
        await categoriesServiceFallback.deleteMainCategory(itemToDelete.item.id)
        toast.success('Main category deleted successfully')
      }
      
      loadCategories()
      loadBudgetSummary()
      handleDialogClose() // Close the edit dialog
      setDeleteConfirmOpen(false)
      setItemToDelete(null)
    } catch (error) {
      console.error('Error deleting:', error)
      toast.error('Failed to delete category')
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setName('')
    setType('expense')
    setSelectedMainCategoryId('')
    setBudgetAmount('')
    setBudgetPeriod('monthly')
    setEditingItem(null)
  }

  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }



  if (loading) {
    return <div className="p-6">Loading categories...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialogMode === 'add-main' && 'Add Main Category'}
                {dialogMode === 'add-sub' && 'Add Subcategory'}
                {dialogMode === 'edit-main' && 'Edit Main Category'}
                {dialogMode === 'edit-sub' && 'Edit Subcategory'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Category name"
                  required
                />
              </div>
              
              {(dialogMode === 'add-main' || dialogMode === 'edit-main') && (
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={type} onValueChange={(value: 'income' | 'expense') => setType(value)}>
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
              
              {(dialogMode === 'add-sub' || dialogMode === 'edit-sub') && (
                <>
                  {dialogMode === 'add-sub' && (
                    <div>
                      <Label htmlFor="mainCategory">Main Category</Label>
                      <Select value={selectedMainCategoryId} onValueChange={setSelectedMainCategoryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select main category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="budgetAmount">Budget Amount</Label>
                    <Input
                      id="budgetAmount"
                      type="number"
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="budgetPeriod">Budget Period</Label>
                    <Select value={budgetPeriod} onValueChange={(value: 'weekly' | 'monthly' | 'yearly') => setBudgetPeriod(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              
              <div className="flex justify-between">
                <div>
                  {(dialogMode === 'edit-main' || dialogMode === 'edit-sub') && (
                    <Button 
                      type="button" 
                      variant="destructive" 
                      onClick={() => {
                         if (editingItem) {
                           handleDeleteConfirm(editingItem, dialogMode === 'edit-sub');
                         }
                       }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {dialogMode.startsWith('add') ? 'Add' : 'Update'}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Deletion</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete {itemToDelete?.isSubcategory ? 'subcategory' : 'category'} 
                <span className="font-semibold">&quot;{itemToDelete?.item?.name}&quot;</span>?
              </p>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setDeleteConfirmOpen(false)
                    setItemToDelete(null)
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDelete}
                >
                  Delete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {budgetSummary && (
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Current Balance</p>
                  <p className={`text-2xl font-bold ${((budgetSummary.totalBudget || 0) - (budgetSummary.totalSpent || 0)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>Rp {((budgetSummary.totalBudget || 0) - (budgetSummary.totalSpent || 0)).toLocaleString('id-ID').replace(/,/g, '.')}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Budget</p>
                    <p className="text-lg font-bold">Rp {(budgetSummary.totalBudget || 0).toLocaleString('id-ID').replace(/,/g, '.')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Spent</p>
                    <p className="text-lg font-bold">Rp {(budgetSummary.totalSpent || 0).toLocaleString('id-ID').replace(/,/g, '.')}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Button */}
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setDialogMode('add-main'); setDialogOpen(true) }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setDialogMode('add-sub'); setDialogOpen(true) }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Subcategory
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid gap-4">
          {categories.map((category) => {
            // Calculate total budget and spent for this category's subcategories
            const categoryBudgets = budgetSummary?.categories?.filter((budget) => 
              category.subcategories?.some((sub) => sub.id === budget.id)
            ) || []
            const totalBudget = categoryBudgets.reduce((sum, budget) => sum + budget.budgetAmount, 0)
            const totalSpent = categoryBudgets.reduce((sum, budget) => sum + budget.spent, 0)
            const totalLeftover = totalBudget - totalSpent
            
            return (
              <Card key={category.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleEdit(category, false)}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col gap-1">
                      <CardTitle className="flex items-center gap-2">
                        {expandedCategories.has(category.id) ? (
                          <ChevronDown className="w-5 h-5 text-gray-500" onClick={(e) => { e.stopPropagation(); toggleCategoryExpansion(category.id); }} />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" onClick={(e) => { e.stopPropagation(); toggleCategoryExpansion(category.id); }} />
                        )}
                        <span>{category.name}</span>
                        <Badge variant={category.type === 'income' ? 'default' : 'secondary'} className={category.type === 'income' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
                          {category.type}
                        </Badge>
                      </CardTitle>
                      {totalBudget > 0 && (
                        <div className="text-sm ml-7 text-black">
                          <span className={totalLeftover > 0 ? 'text-green-600' : 'text-black'}>Rp {totalLeftover.toLocaleString('id-ID').replace(/,/g, '.')}</span> left from Rp {totalBudget.toLocaleString('id-ID').replace(/,/g, '.')}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {expandedCategories.has(category.id) && category.subcategories && category.subcategories.length > 0 && (
                  <CardContent>
                    <div className="space-y-2">
                      {category.subcategories.map((subcategory: any) => {
                        const subBudget = budgetSummary?.categories?.find((budget: any) => budget.id === subcategory.id)
                        const budgetAmount = subBudget?.budgetAmount || subcategory.budgetAmount || 0
                        const spent = subBudget?.spent || 0
                        const leftover = budgetAmount - spent
                        
                        return (
                          <div key={subcategory.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border cursor-pointer hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); handleEdit(subcategory, true); }}>
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{subcategory.name}</span>
                              {budgetAmount > 0 && (
                                <div className="text-sm text-black">
                                  <span className={leftover > 0 ? 'text-green-600' : 'text-black'}>Rp {leftover.toLocaleString('id-ID').replace(/,/g, '.')}</span> left from Rp {budgetAmount.toLocaleString('id-ID').replace(/,/g, '.')}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}