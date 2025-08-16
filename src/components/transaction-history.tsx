'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
// Table imports removed as we're now using card layout
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Filter, Calendar, DollarSign } from 'lucide-react'
import { transactionService } from '../services/transaction-service'
import { fundsService } from '../services/funds-service'
import { categoriesService } from '../services/categories-service'
import { categoriesServiceV2, type MainCategory, type Subcategory } from '../services/categories-service-v2'
import type { Transaction, Fund, Category } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'
import { formatIDR } from '../lib/utils'

// Fallback categories if database is not available
const fallbackCategories = {
  expense: [
    { value: 'Food & Dining', label: 'Food & Dining' },
    { value: 'Transportation', label: 'Transportation' },
    { value: 'Shopping', label: 'Shopping' },
    { value: 'Entertainment', label: 'Entertainment' },
    { value: 'Bills & Utilities', label: 'Bills & Utilities' },
    { value: 'Healthcare', label: 'Healthcare' },
    { value: 'Education', label: 'Education' },
    { value: 'Travel', label: 'Travel' },
    { value: 'Other', label: 'Other' },
  ],
  income: [
    { value: 'Salary', label: 'Salary' },
    { value: 'Freelance', label: 'Freelance' },
    { value: 'Business', label: 'Business' },
    { value: 'Investment', label: 'Investment' },
    { value: 'Gift', label: 'Gift' },
    { value: 'Other', label: 'Other' },
  ],
}

export function TransactionHistory() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [funds, setFunds] = useState<Fund[]>([])
  const [categories, setCategories] = useState<MainCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  
  // Form state
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([])


  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [sourceOfFundsId, setSourceOfFundsId] = useState('none')
  const [status, setStatus] = useState<'paid' | 'unpaid'>('paid')
  const [note, setNote] = useState('')
  
  // Filter state
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  
  // Transaction detail popup state
  const [isTransactionDetailOpen, setIsTransactionDetailOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  
  // Delete confirmation dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    try {
      setLoading(true)
      const [transactionsData, fundsData] = await Promise.all([
        transactionService.getTransactions(),
        fundsService.getFunds()
      ])
      setTransactions(transactionsData)
      await loadCategories()
      await loadAllSubcategories()
      setFunds(fundsData)
      
      // Auto-select default fund for new transactions
      try {
        const defaultFund = await fundsService.getDefaultFund()
        if (defaultFund && sourceOfFundsId === 'none') {
          setSourceOfFundsId(defaultFund.id)
        }
      } catch (error) {
        // Default fund not found or error, keep 'none' selection
        console.log('No default fund found')
      }
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    if (!user) return
    
    try {
      const { data, error } = await categoriesServiceV2.getMainCategories(user.id)
      if (error) {
        console.error('Error loading categories:', error)
        // Use fallback categories
        const fallbackCategoriesList: MainCategory[] = [
          ...fallbackCategories.expense.map((cat, index) => ({
            id: `fallback-expense-${index}`,
            user_id: user?.id || '',
            name: cat.label,
            type: 'expense' as const,
            is_active: true
          })),
          ...fallbackCategories.income.map((cat, index) => ({
            id: `fallback-income-${index}`,
            user_id: user?.id || '',
            name: cat.label,
            type: 'income' as const,
            is_active: true
          }))
        ]
        setCategories(fallbackCategoriesList)
      } else {
        setCategories(data || [])
      }
    } catch (error) {
      console.error('Error loading categories:', error)
      // Use fallback categories
      const fallbackCategoriesList: MainCategory[] = [
        ...fallbackCategories.expense.map((cat, index) => ({
          id: `fallback-expense-${index}`,
          user_id: user?.id || '',
          name: cat.label,
          type: 'expense' as const,
          is_active: true
        })),
        ...fallbackCategories.income.map((cat, index) => ({
          id: `fallback-income-${index}`,
          user_id: user?.id || '',
          name: cat.label,
          type: 'income' as const,
          is_active: true
        }))
      ]
      setCategories(fallbackCategoriesList)
    }
  }

  const loadAllSubcategories = async () => {
    if (!user) return
    
    try {
      const { data: subcategoriesData, error } = await categoriesServiceV2.getAllSubcategories(user.id)
      if (error) {
        console.error('Error loading all subcategories:', error)
        setAllSubcategories([])
      } else {
        setAllSubcategories(subcategoriesData || [])
      }
    } catch (error) {
      console.error('Error loading all subcategories:', error)
      setAllSubcategories([])
    }
  }

  // Helper function to get categories by type
  const getCategoriesByType = (categoryType: 'income' | 'expense') => {
    return categories.filter(cat => cat.type === categoryType)
  }

  // Fetch subcategories when main category is selected
  const handleCategoryChange = async (categoryId: string) => {
    setCategory(categoryId)
    setSubcategory('') // Reset subcategory when main category changes
    
    if (categoryId && user) {
      try {
        const { data: subcategoriesData, error } = await categoriesServiceV2.getSubcategories(categoryId)
        if (error) {
          console.error('Error fetching subcategories:', error)
          setSubcategories([])
        } else {
          setSubcategories(subcategoriesData || [])
        }
      } catch (error) {
        console.error('Error fetching subcategories:', error)
        setSubcategories([])
      }
    } else {
      setSubcategories([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!amount || !category) {
      toast.error('Please fill in all required fields')
      return
    }

    const amountValue = parseInt(amount.replace(/[^0-9]/g, ''), 10)
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    try {
      // Use category name as description if editing existing transaction with description, otherwise use category name
      const categoryName = getCategoryName(subcategory || category)
      const transactionData = {
        description: editingTransaction?.description || categoryName,
        amount: amountValue,
        category: subcategory || category, // Use subcategory if selected, otherwise main category
        type,
        date,
        source_of_funds_id: sourceOfFundsId === 'none' ? undefined : sourceOfFundsId,
        status,
        note: note.trim() || undefined
      }

      if (editingTransaction) {
        await transactionService.updateTransaction(editingTransaction.id, transactionData)
        toast.success('Transaction updated successfully')
      } else {
        await transactionService.createTransaction(transactionData)
        toast.success('Transaction added successfully')
      }
      
      // Reset form and close dialog
      await resetForm()
      setIsDialogOpen(false)
      
      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error saving transaction:', error)
      toast.error('Failed to save transaction')
    }
  }

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setDescription(transaction.description)
    setAmount(transaction.amount.toString())
    setCategory(transaction.category)
    setType(transaction.type)
    setDate(transaction.date)
    setSourceOfFundsId(transaction.source_of_funds_id || 'none')
    setStatus(transaction.status)
    setNote(transaction.note || '')
    setIsDialogOpen(true)
  }

  const handleDelete = (transaction: Transaction) => {
    console.log('Delete button clicked for transaction:', transaction)
    console.log('Transaction ID:', transaction.id)
    console.log('Transaction description:', transaction.description)
    
    setTransactionToDelete(transaction)
    setIsDeleteDialogOpen(true)
  }
  
  const confirmDelete = async () => {
    if (!transactionToDelete) return
    
    console.log('User confirmed deletion, proceeding...')
    
    try {
      console.log('Calling transactionService.deleteTransaction with ID:', transactionToDelete.id)
      const result = await transactionService.deleteTransaction(transactionToDelete.id)
      console.log('Delete service response:', result)
      
      toast.success('Transaction deleted successfully')
      console.log('Reloading data...')
      await loadData()
      console.log('Data reloaded successfully')
      
      setIsDeleteDialogOpen(false)
      setTransactionToDelete(null)
    } catch (error) {
      console.error('Error deleting transaction:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      })
      toast.error('Failed to delete transaction')
    }
  }
  
  const cancelDelete = () => {
    console.log('User cancelled deletion')
    setIsDeleteDialogOpen(false)
    setTransactionToDelete(null)
  }

  const resetForm = async () => {
    setEditingTransaction(null)
    setDescription('')
    setAmount('')
    setCategory('')
    setSubcategory('')
    setSubcategories([])
    setType('expense')
    setDate(new Date().toISOString().split('T')[0])
    setStatus('paid')
    setNote('')
    
    // Auto-select default fund for new transactions
    try {
      const defaultFund = await fundsService.getDefaultFund()
      setSourceOfFundsId(defaultFund ? defaultFund.id : 'none')
    } catch (error) {
      setSourceOfFundsId('none')
    }
  }

  const handleDialogClose = async () => {
    setIsDialogOpen(false)
    await resetForm()
  }

  const handleTransactionClick = (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsTransactionDetailOpen(true)
  }

  const handleTransactionDetailClose = () => {
    setIsTransactionDetailOpen(false)
    setSelectedTransaction(null)
  }

  const handleEditFromDetail = () => {
    if (selectedTransaction) {
      handleEdit(selectedTransaction)
      setIsTransactionDetailOpen(false)
    }
  }

  const handleDeleteFromDetail = () => {
    if (selectedTransaction) {
      setIsTransactionDetailOpen(false)
      handleDelete(selectedTransaction)
    }
  }

  const formatCurrency = (amount: number) => {
    return formatIDR(amount)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = date.getDate()
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const year = date.getFullYear()
    
    // Add ordinal suffix to day
    const getOrdinalSuffix = (day: number) => {
      if (day > 3 && day < 21) return 'th'
      switch (day % 10) {
        case 1: return 'st'
        case 2: return 'nd'
        case 3: return 'rd'
        default: return 'th'
      }
    }
    
    return `${day}${getOrdinalSuffix(day)} ${month} ${year}`
  }

  const filteredTransactions = transactions.filter(transaction => {
    if (filterCategory !== 'all' && transaction.category !== filterCategory) return false
    if (filterType !== 'all' && transaction.type !== filterType) return false
    if (filterStatus !== 'all' && transaction.status !== filterStatus) return false
    return true
  })

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

  const allCategories = [...new Set(transactions.map(t => t.category))]

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-64 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Transaction</h1>
          <div className="w-10 h-10"></div> {/* Spacer for avatar */}
        </div>
      </div>
      
      <div className="px-6 space-y-6">
        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-4">
          <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Filter Transactions</DialogTitle>
                <DialogDescription>
                  Filter transactions by type, category, and status.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {allCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {getCategoryName(cat)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setFilterType('all')
                      setFilterCategory('all')
                      setFilterStatus('all')
                    }}
                    className="flex-1"
                  >
                    Clear Filters
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => setIsFilterDialogOpen(false)}
                    className="flex-1"
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
              </DialogTitle>
              <DialogDescription>
                {editingTransaction ? 'Update the transaction details below.' : 'Fill in the details to add a new transaction to your records.'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="text"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '')
                    const formatted = value ? parseInt(value).toLocaleString('id-ID') : ''
                    setAmount(formatted)
                  }}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select value={type} onValueChange={(value: 'income' | 'expense') => {
                  setType(value)
                  setCategory('') // Reset category when type changes
                  setSubcategory('') // Reset subcategory when type changes
                  setSubcategories([]) // Clear subcategories list
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={category} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {getCategoriesByType(type).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {subcategories.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="subcategory">Subcategory (Optional)</Label>
                  <Select value={subcategory} onValueChange={setSubcategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subcategory (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map((subcat) => (
                        <SelectItem key={subcat.id} value={subcat.id}>
                          {subcat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="date">Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="source">Source of Funds</Label>
                <Select value={sourceOfFundsId} onValueChange={setSourceOfFundsId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select funding source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No funding source</SelectItem>
                    {funds.map((fund) => (
                      <SelectItem key={fund.id} value={fund.id}>
                        {fund.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select value={status} onValueChange={(value: 'paid' | 'unpaid') => setStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  placeholder="Optional note (e.g., details about the transaction)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                {editingTransaction ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => {
                      if (editingTransaction) {
                        handleDialogClose()
                        handleDelete(editingTransaction)
                      }
                    }} className="text-red-600 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button type="submit" className="flex-1">
                      Update Transaction
                    </Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="outline" onClick={handleDialogClose}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                      Add Transaction
                    </Button>
                  </>
                )}
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>



      {/* Transactions Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {transactions.length === 0 
                  ? "Add your first transaction to get started"
                  : "Try adjusting your filters"
                }
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Transaction
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Card View */}
              <div className="hidden md:block space-y-3 p-4">
                {filteredTransactions.map((transaction) => (
                  <div 
                    key={transaction.id} 
                    className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200"
                    onClick={() => handleEdit(transaction)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-lg mb-1">{getCategoryName(transaction.category)}</div>
                        <div className="text-sm text-gray-500 mb-1">
                          {transaction.source_of_funds_id ? funds.find(f => f.id === transaction.source_of_funds_id)?.name || 'Unknown Fund' : 'No Fund'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-xl mb-1 ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(transaction.date)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 p-4">
                {filteredTransactions.map((transaction) => (
                  <div 
                    key={transaction.id} 
                    className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200"
                    onClick={() => handleEdit(transaction)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 text-base mb-1">{getCategoryName(transaction.category)}</div>
                        <div className="text-sm text-gray-500 mb-2">
                          {transaction.source_of_funds_id ? funds.find(f => f.id === transaction.source_of_funds_id)?.name || 'Unknown Fund' : 'No Fund'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-bold text-lg mb-1 ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatDate(transaction.date)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Transaction Detail Dialog */}
      <Dialog open={isTransactionDetailOpen} onOpenChange={setIsTransactionDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Description</Label>
                <p className="text-lg font-medium">{selectedTransaction.description}</p>
              </div>
              
              {selectedTransaction.note && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Note</Label>
                  <p className="text-sm text-gray-700">{selectedTransaction.note}</p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Amount</Label>
                  <p className={`text-lg font-bold ${
                    selectedTransaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {selectedTransaction.type === 'income' ? '+' : '-'}{formatCurrency(selectedTransaction.amount)}
                  </p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-600">Type</Label>
                  <Badge variant={selectedTransaction.type === 'income' ? 'default' : 'secondary'} className="mt-1">
                    {selectedTransaction.type === 'income' ? 'Income' : 'Expense'}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Category</Label>
                  <p className="text-sm">{getCategoryName(selectedTransaction.category)}</p>
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-600">Status</Label>
                  <Badge variant={selectedTransaction.status === 'paid' ? 'default' : 'secondary'} className="mt-1">
                    {selectedTransaction.status === 'paid' ? 'Paid' : 'Unpaid'}
                  </Badge>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Date</Label>
                  <p className="text-sm">{formatDate(selectedTransaction.date)}</p>
                </div>
                
                {selectedTransaction.fund && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">Source of Funds</Label>
                    <p className="text-sm">{selectedTransaction.fund.name}</p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleEditFromDetail}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDeleteFromDetail}
                  className="flex-1 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{transactionToDelete?.description}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={cancelDelete}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}