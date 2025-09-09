'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
// Table imports removed as we're now using card layout
import { toast } from 'sonner'
import { Plus, Trash2, Filter, Wallet } from 'lucide-react'
import Image from 'next/image'
import { transactionService } from '../services/transaction-service'
import { fundsService } from '../services/funds-service'

import { categoriesServiceV2, type MainCategory, type Subcategory } from '../services/categories-service-v2'
import { dateRangeService } from '../services/date-range-service'
import type { Transaction, Fund } from '../lib/supabase'
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
  const { user, loading: authLoading } = useAuth()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [funds, setFunds] = useState<Fund[]>([])
  const [categories, setCategories] = useState<MainCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null)
  const [isSyncConfirmDialogOpen, setIsSyncConfirmDialogOpen] = useState(false)
  const [linkedTransaction, setLinkedTransaction] = useState<Transaction | null>(null)
  
  // Form state
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([])


  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [sourceOfFundsId, setSourceOfFundsId] = useState('none')
  const [destinationFundId, setDestinationFundId] = useState('none') // For Internal Transfer
  const [status, setStatus] = useState<'paid' | 'unpaid'>('paid')
  const [note, setNote] = useState('')
  
  // Filter state
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterSubcategory, setFilterSubcategory] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSourceOfFunds, setFilterSourceOfFunds] = useState('all')
  const [filterDateStart, setFilterDateStart] = useState('')
  const [filterDateEnd, setFilterDateEnd] = useState('')
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false)
  const [currentPeriodDescription, setCurrentPeriodDescription] = useState('')
  const [useCustomDateRange, setUseCustomDateRange] = useState(true)
  
  // Reset subcategory filter when main category filter changes
  useEffect(() => {
    if (filterCategory !== 'all') {
      // Check if current subcategory belongs to the selected main category
      const currentSubcategory = allSubcategories.find(sub => sub.id === filterSubcategory)
      if (currentSubcategory && currentSubcategory.main_category_id !== filterCategory) {
        setFilterSubcategory('all')
      }
    }
  }, [filterCategory, allSubcategories, filterSubcategory])

  
  // Delete confirmation dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)



  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      
      // Load transactions based on date range preference
      let transactionsData: Transaction[]
      if (useCustomDateRange) {
        // Use server-side filtering for current period
        const currentPeriod = await dateRangeService.getCurrentPeriodRange()
        transactionsData = await transactionService.getTransactionsByDateRange(
          currentPeriod.startDate,
          currentPeriod.endDate
        )
      } else {
        // Load all transactions for manual date filtering
        transactionsData = await transactionService.getTransactions()
      }
      
      const [fundsData] = await Promise.all([
        fundsService.getFunds()
      ])
      
      setTransactions(transactionsData)
      await loadCategories()
      await loadAllSubcategories()
      setFunds(fundsData)
      
      // Load current period description
      const periodDescription = await dateRangeService.getCurrentPeriodDescription()
      setCurrentPeriodDescription(periodDescription)
      
      // Keep source of funds as 'none' for new transactions
    } catch (error) {
      console.error('Error loading data:', error instanceof Error ? error.message : String(error))
      toast.error('Failed to load data', { duration: 1000 })
    } finally {
      setLoading(false)
    }
  }, [sourceOfFundsId, user, useCustomDateRange]) // loadCategories and loadAllSubcategories are stable (useCallback with [user])

  useEffect(() => {
    if (user) {
      loadData()
    } else if (!authLoading) {
      // If no user and auth is not loading, set loading to false
      setLoading(false)
    }
  }, [user, authLoading, loadData])

  const loadCategories = useCallback(async () => {
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
      console.error('Error loading categories:', error instanceof Error ? error.message : String(error))
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
  }, [user])

  const loadAllSubcategories = useCallback(async () => {
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
      console.error('Error loading all subcategories:', error instanceof Error ? error.message : String(error))
      setAllSubcategories([])
    }
  }, [user])

  // Helper function to get categories by type
  const getCategoriesByType = (categoryType: 'income' | 'expense') => {
    return categories.filter(cat => cat.type === categoryType)
  }

  // Helper function to check if selected category/subcategory is Internal Transfer
  const isInternalTransfer = () => {
    const selectedCategoryId = subcategory || category
    const selectedSubcategory = allSubcategories.find(sub => sub.id === selectedCategoryId)
    return selectedSubcategory?.name?.toLowerCase().includes('internal transfer') || false
  }

  // Helper function to check if a transaction is Internal Transfer
  const isTransactionInternalTransfer = (transaction: Transaction) => {
    const transactionSubcategory = allSubcategories.find(sub => sub.id === transaction.category)
    return transactionSubcategory?.name?.toLowerCase().includes('internal transfer') || false
  }

  // Helper function to find linked Internal Transfer transaction
  const findLinkedInternalTransfer = (transaction: Transaction) => {
    if (!isTransactionInternalTransfer(transaction)) return null
    
    // Only consider transactions truly linked when they have proper destination_fund_id relationships
    if (transaction.destination_fund_id) {
      const oppositeType = transaction.type === 'expense' ? 'income' : 'expense'
      const linked = transactions.find(t => 
        t.id !== transaction.id &&
        t.type === oppositeType &&
        t.destination_fund_id === transaction.source_of_funds_id &&
        t.source_of_funds_id === transaction.destination_fund_id &&
        t.amount === transaction.amount &&
        t.date === transaction.date &&
        isTransactionInternalTransfer(t)
      )
      return linked || null
    }
    
    // For transactions without destination_fund_id, they are not considered linked
    // This prevents false positives where unrelated transactions might match by coincidence
    return null
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
        console.error('Error fetching subcategories:', error instanceof Error ? error.message : String(error))
        setSubcategories([])
      }
    } else {
      setSubcategories([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!amount || !category) {
      toast.error('Please fill in all required fields', { duration: 1000 })
      return
    }

    // Validate destination fund for Internal Transfer expense transactions
    if (isInternalTransfer() && type === 'expense' && destinationFundId === 'none') {
      toast.error('Please select a destination fund for Internal Transfer', { duration: 1000 })
      return
    }

    const amountValue = parseInt(amount.replace(/[^0-9]/g, ''), 10)
    if (isNaN(amountValue) || amountValue <= 0) {
      toast.error('Please enter a valid amount', { duration: 1000 })
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
        destination_fund_id: isInternalTransfer() && type === 'expense' && destinationFundId !== 'none' ? destinationFundId : undefined,
        status,
        note: note.trim() || undefined
      }

      if (editingTransaction) {
        // Check if this is an Internal Transfer edit that needs synchronization
        if (isTransactionInternalTransfer(editingTransaction) && destinationFundId !== 'none') {
          const linkedTransaction = findLinkedInternalTransfer(editingTransaction)
          if (linkedTransaction) {
            // Update the main transaction
            await transactionService.updateTransaction(editingTransaction.id, transactionData)
            
            // Update the linked transaction with corresponding changes
            const linkedUpdates = {
              amount: amountValue,
              date,
              status,
              note: note.trim() || undefined,
              source_of_funds_id: destinationFundId === 'none' ? undefined : destinationFundId,
              description: editingTransaction.type === 'expense' 
                ? `Internal Transfer from ${funds.find(f => f.id === sourceOfFundsId)?.name || 'Unknown'}`
                : `Internal Transfer to ${funds.find(f => f.id === destinationFundId)?.name || 'Unknown'}`
            }
            
            await transactionService.updateTransaction(linkedTransaction.id, linkedUpdates)
            toast.success('Internal Transfer synchronized successfully', { duration: 1000 })
          } else {
            await transactionService.updateTransaction(editingTransaction.id, transactionData)
            toast.success('Transaction updated successfully', { duration: 1000 })
          }
        } else if (isInternalTransfer() && destinationFundId !== 'none') {
          // This is a regular transaction being converted to Internal Transfer
          await transactionService.updateTransaction(editingTransaction.id, transactionData)
          
          // Create the corresponding income transaction
          const salaryCategory = categories.find(cat => cat.name === 'Salary' && cat.type === 'income')
          const internalTransferIncomeSubcat = allSubcategories.find(sub => 
            sub.name.toLowerCase().includes('internal transfer') && 
            sub.main_category_id === salaryCategory?.id
          )
          
          const incomeTransactionData = {
            description: `Internal Transfer from ${funds.find(f => f.id === sourceOfFundsId)?.name || 'Unknown'}`,
            amount: amountValue,
            category: internalTransferIncomeSubcat?.id || salaryCategory?.id || subcategory || category,
            type: 'income' as const,
            date,
            source_of_funds_id: destinationFundId,
            destination_fund_id: sourceOfFundsId, // Link back to the source fund
            status,
            note: note.trim() || undefined
          }
          
          await transactionService.createTransaction(incomeTransactionData)
          toast.success('Transaction converted to Internal Transfer successfully', { duration: 1000 })
        } else {
          await transactionService.updateTransaction(editingTransaction.id, transactionData)
          toast.success('Transaction updated successfully', { duration: 1000 })
        }
      } else {
        // Create the expense transaction
        await transactionService.createTransaction(transactionData)
        
        // If it's an Internal Transfer, create corresponding income transaction
        if (isInternalTransfer() && destinationFundId !== 'none') {
          // Find the "Internal Transfer" subcategory under "Salary" for income
          const salaryCategory = categories.find(cat => cat.name === 'Salary' && cat.type === 'income')
          const internalTransferIncomeSubcat = allSubcategories.find(sub => 
            sub.name.toLowerCase().includes('internal transfer') && 
            sub.main_category_id === salaryCategory?.id
          )
          
          const incomeTransactionData = {
            description: `Internal Transfer from ${funds.find(f => f.id === sourceOfFundsId)?.name || 'Unknown'}`,
            amount: amountValue,
            category: internalTransferIncomeSubcat?.id || salaryCategory?.id || subcategory || category,
            type: 'income' as const,
            date,
            source_of_funds_id: destinationFundId,
            destination_fund_id: sourceOfFundsId, // Link back to the source fund
            status,
            note: note.trim() || undefined
          }
          
          await transactionService.createTransaction(incomeTransactionData)
          toast.success('Internal Transfer completed successfully', { duration: 1000 })
        } else {
          toast.success('Transaction added successfully', { duration: 1000 })
        }
      }
      
      // Reset form and close dialog
      await resetForm()
      setIsDialogOpen(false)
      
      // Reload data
      await loadData()
    } catch (error) {
      console.error('Error saving transaction:', error instanceof Error ? error.message : String(error))
      toast.error('Failed to save transaction', { duration: 1000 })
    }
  }

  const handleEdit = async (transaction: Transaction) => {
    // Check if this is an Internal Transfer transaction
    if (isTransactionInternalTransfer(transaction)) {
      const linked = findLinkedInternalTransfer(transaction)
      if (linked) {
        setEditingTransaction(transaction)
        setLinkedTransaction(linked)
        setIsSyncConfirmDialogOpen(true)
        return
      }
    }
    
    // Proceed with normal edit flow
    await proceedWithEdit(transaction)
  }
  
  const proceedWithEdit = async (transaction: Transaction) => {
    setEditingTransaction(transaction)
    setAmount(transaction.amount.toString())
    setType(transaction.type)
    setDate(transaction.date)
    setSourceOfFundsId(transaction.source_of_funds_id || 'none')
    
    // For Internal Transfer, set destination fund based on linked transaction
    if (isTransactionInternalTransfer(transaction)) {
      const linked = findLinkedInternalTransfer(transaction)
      if (linked) {
        setDestinationFundId(linked.source_of_funds_id || 'none')
      } else {
        setDestinationFundId('none')
      }
    } else {
      setDestinationFundId('none') // Reset destination fund for non-internal transfers
    }
    
    setStatus(transaction.status)
    setNote(transaction.note || '')
    
    // Determine if the category is a main category or subcategory
    const isMainCategory = categories.find(cat => cat.id === transaction.category)
    const matchingSubcategory = allSubcategories.find(sub => sub.id === transaction.category)
    
    if (isMainCategory) {
      // It's a main category
      setCategory(transaction.category)
      setSubcategory('')
      // Load subcategories for this main category
      try {
        const { data: subcategoriesData, error } = await categoriesServiceV2.getSubcategories(transaction.category)
        if (error) {
          console.error('Error fetching subcategories:', error)
          setSubcategories([])
        } else {
          setSubcategories(subcategoriesData || [])
        }
      } catch (error) {
        console.error('Error fetching subcategories:', error instanceof Error ? error.message : String(error))
        setSubcategories([])
      }
    } else if (matchingSubcategory) {
      // It's a subcategory
      setCategory(matchingSubcategory.main_category_id)
      setSubcategory(transaction.category)
      // Load subcategories for the main category
      try {
        const { data: subcategoriesData, error } = await categoriesServiceV2.getSubcategories(matchingSubcategory.main_category_id)
        if (error) {
          console.error('Error fetching subcategories:', error)
          setSubcategories([])
        } else {
          setSubcategories(subcategoriesData || [])
        }
      } catch (error) {
        console.error('Error fetching subcategories:', error instanceof Error ? error.message : String(error))
        setSubcategories([])
      }
    } else {
      // Fallback - treat as main category
      setCategory(transaction.category)
      setSubcategory('')
      setSubcategories([])
    }
    
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
      
      toast.success('Transaction deleted successfully', { duration: 1000 })
      console.log('Reloading data...')
      await loadData()
      console.log('Data reloaded successfully')
      
      setIsDeleteDialogOpen(false)
      setTransactionToDelete(null)
    } catch (error) {
      console.error('Error deleting transaction:', error instanceof Error ? error.message : String(error))
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      })
      toast.error('Failed to delete transaction', { duration: 1000 })
    }
  }
  
  const cancelDelete = () => {
    console.log('User cancelled deletion')
    setIsDeleteDialogOpen(false)
    setTransactionToDelete(null)
  }

  const resetForm = async (isNewTransaction = true) => {
    setEditingTransaction(null)
    setAmount('')
    setCategory('')
    setSubcategory('')
    setSubcategories([])
    setType('expense')
    if (isNewTransaction) {
      setDate(new Date().toISOString().split('T')[0])
    }
    setStatus('paid')
    setNote('')
    setDestinationFundId('none') // Reset destination fund
    
    // Always reset source of funds to 'none' for new transactions
    setSourceOfFundsId('none')
  }

  const handleDialogClose = async () => {
    setIsDialogOpen(false)
    await resetForm(true) // Always reset for new transactions when dialog closes
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

  const filteredTransactions = useMemo(() => {
    console.log('=== FILTER DEBUG START ===')
    console.log('Filter states:', {
      filterCategory,
      filterSubcategory,
      filterType,
      filterStatus,
      filterSourceOfFunds,
      filterDateStart,
      filterDateEnd
    })
    console.log('Total transactions:', transactions.length)
    console.log('Available categories:', categories.map(c => ({ id: c.id, name: c.name })))
    console.log('Available subcategories:', allSubcategories.map(s => ({ id: s.id, name: s.name, main_category_id: s.main_category_id })))
    console.log('Available funds:', funds.map(f => ({ id: f.id, name: f.name })))
    
    const filtered = transactions.filter(transaction => {
      console.log(`\n--- Checking transaction ${transaction.id} ---`)
      console.log('Transaction data:', {
        id: transaction.id,
        category: transaction.category,
        type: transaction.type,
        status: transaction.status,
        source_of_funds_id: transaction.source_of_funds_id,
        date: transaction.date,
        amount: transaction.amount
      })
      
      // Category/Subcategory filtering logic
      if (filterCategory !== 'all' || filterSubcategory !== 'all') {
        console.log('Checking category/subcategory filters...')
        if (filterSubcategory !== 'all') {
          console.log(`Subcategory filter: ${filterSubcategory}, transaction category: ${transaction.category}`)
          // If subcategory is selected, filter by subcategory only
          if (transaction.category !== filterSubcategory) {
            console.log('❌ Failed subcategory filter')
            return false
          }
          console.log('✅ Passed subcategory filter')
        } else if (filterCategory !== 'all') {
          console.log(`Main category filter: ${filterCategory}, transaction category: ${transaction.category}`)
          // If only main category is selected, check if transaction category is either:
          // 1. The main category itself, or
          // 2. A subcategory of the main category
          const isMainCategory = transaction.category === filterCategory
          const matchingSubcategory = allSubcategories.find(sub => sub.id === transaction.category)
          const isSubcategoryOfMain = matchingSubcategory && matchingSubcategory.main_category_id === filterCategory
          
          console.log('Category check results:', {
            isMainCategory,
            matchingSubcategory: matchingSubcategory ? { id: matchingSubcategory.id, name: matchingSubcategory.name, main_category_id: matchingSubcategory.main_category_id } : null,
            isSubcategoryOfMain
          })
          
          if (!isMainCategory && !isSubcategoryOfMain) {
            console.log('❌ Failed main category filter')
            return false
          }
          console.log('✅ Passed main category filter')
        }
      }
      
      if (filterType !== 'all' && transaction.type !== filterType) {
        console.log(`❌ Failed type filter: ${filterType} vs ${transaction.type}`)
        return false
      }
      console.log('✅ Passed type filter')
      
      if (filterStatus !== 'all' && transaction.status !== filterStatus) {
        console.log(`❌ Failed status filter: ${filterStatus} vs ${transaction.status}`)
        return false
      }
      console.log('✅ Passed status filter')
      
      if (filterSourceOfFunds !== 'all' && transaction.source_of_funds_id !== filterSourceOfFunds) {
        console.log(`❌ Failed source of funds filter: ${filterSourceOfFunds} vs ${transaction.source_of_funds_id}`)
        return false
      }
      console.log('✅ Passed source of funds filter')
      
      // Date range filtering
      if (!useCustomDateRange) {
        // Use manual date range filters (custom date range is already filtered server-side)
        if (filterDateStart && transaction.date < filterDateStart) {
          console.log(`❌ Failed start date filter: ${transaction.date} < ${filterDateStart}`)
          return false
        }
        if (filterDateEnd && transaction.date > filterDateEnd) {
          console.log(`❌ Failed end date filter: ${transaction.date} > ${filterDateEnd}`)
          return false
        }
        console.log('✅ Passed manual date range filter')
      } else {
        console.log('✅ Using server-side date filtering (custom date range)')
      }
      
      console.log('✅ Transaction passed all filters')
      return true
    })
    
    console.log(`\n=== FILTER RESULTS ===`)
    console.log(`Filtered transactions: ${filtered.length}/${transactions.length}`)
    console.log('Filtered transaction IDs:', filtered.map(t => t.id))
    console.log('=== FILTER DEBUG END ===\n')
    
    return filtered.sort((a, b) => {
      // Sort by date in descending order (most recent first)
      const dateA = new Date(a.date)
      const dateB = new Date(b.date)
      return dateB.getTime() - dateA.getTime()
    })
  }, [transactions, filterCategory, filterSubcategory, filterType, filterStatus, filterSourceOfFunds, filterDateStart, filterDateEnd, useCustomDateRange, categories, subcategories, funds, allSubcategories])

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

  // Get all available categories (both main categories and subcategories)
  const allCategories = useMemo(() => {
    const categoryIds = new Set<string>()
    
    // Add all main categories
    categories.forEach((cat: MainCategory) => categoryIds.add(cat.id))
    
    // Add all subcategories
    subcategories.forEach((subcat: Subcategory) => categoryIds.add(subcat.id))
    
    return Array.from(categoryIds)
  }, [categories, subcategories])

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filterCategory !== 'all' || 
           filterSubcategory !== 'all' || 
           filterType !== 'all' || 
           filterStatus !== 'all' || 
           filterSourceOfFunds !== 'all' || 
           filterDateStart !== '' || 
           filterDateEnd !== '' ||
           !useCustomDateRange
  }, [filterCategory, filterSubcategory, filterType, filterStatus, filterSourceOfFunds, filterDateStart, filterDateEnd, useCustomDateRange])

  if (loading || authLoading) {
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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transaction</h1>
            {currentPeriodDescription && (
              <p className="text-sm text-gray-600 mt-1">Period: {currentPeriodDescription}</p>
            )}
          </div>
          <div className="w-10 h-10"></div> {/* Spacer for avatar */}
        </div>
      </div>
      
      <div className="px-6 space-y-6">
        {/* Action Buttons */}
        <div className="flex justify-between items-center gap-4">
          <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className={hasActiveFilters ? "bg-blue-50 border-blue-200 text-blue-700" : ""}>
                <Filter className="w-4 h-4 mr-2" />
                Filter
                {hasActiveFilters && (
                  <span className="ml-2 bg-blue-500 text-white text-xs rounded-full w-2 h-2"></span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                  <Label>Subcategory</Label>
                  <Select value={filterSubcategory} onValueChange={setFilterSubcategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subcategories</SelectItem>
                      {allSubcategories
                        .filter(subcat => filterCategory === 'all' || subcat.main_category_id === filterCategory)
                        .map((subcat) => (
                          <SelectItem key={subcat.id} value={subcat.id}>
                            {subcat.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Source of Funds</Label>
                  <Select value={filterSourceOfFunds} onValueChange={setFilterSourceOfFunds}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Sources">
                        {filterSourceOfFunds && filterSourceOfFunds !== 'all' && (() => {
                          const selectedFund = funds.find(f => f.id === filterSourceOfFunds);
                          if (selectedFund) {
                            return (
                              <div className="flex items-center gap-2">
                                {selectedFund.image_url ? (
                                  <Image 
                                    src={selectedFund.image_url} 
                                    alt={selectedFund.name}
                                    width={16}
                                    height={16}
                                    className="w-4 h-4 rounded-sm object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`w-4 h-4 bg-gradient-to-br from-teal-500 to-teal-600 rounded-sm flex items-center justify-center text-white font-bold text-xs ${selectedFund.image_url ? 'hidden' : ''}`}>
                                  {selectedFund.name.substring(0, 1).toUpperCase()}
                                </div>
                                {selectedFund.name}
                              </div>
                            );
                          }
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {funds.map((fund) => (
                        <SelectItem key={fund.id} value={fund.id}>
                          <div className="flex items-center gap-2">
                            {fund.image_url ? (
                              <Image 
                                src={fund.image_url} 
                                alt={fund.name}
                                width={16}
                                height={16}
                                className="w-4 h-4 rounded-sm object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`w-4 h-4 bg-gradient-to-br from-teal-500 to-teal-600 rounded-sm flex items-center justify-center text-white font-bold text-xs ${fund.image_url ? 'hidden' : ''}`}>
                              {fund.name.substring(0, 1).toUpperCase()}
                            </div>
                            {fund.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="use-custom-date-range"
                      checked={useCustomDateRange}
                      onChange={(e) => setUseCustomDateRange(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="use-custom-date-range">Use custom period ({currentPeriodDescription})</Label>
                  </div>
                  
                  {!useCustomDateRange && (
                    <div>
                      <Label>Manual Date Range</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="filter-date-start" className="text-xs">From</Label>
                          <Input
                            id="filter-date-start"
                            type="date"
                            value={filterDateStart}
                            onChange={(e) => setFilterDateStart(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="filter-date-end" className="text-xs">To</Label>
                          <Input
                            id="filter-date-end"
                            type="date"
                            value={filterDateEnd}
                            onChange={(e) => setFilterDateEnd(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  )}
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
                      setFilterSubcategory('all')
                      setFilterStatus('all')
                      setFilterSourceOfFunds('all')
                      setFilterDateStart('')
                      setFilterDateEnd('')
                      setUseCustomDateRange(true)
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
              <Button onClick={() => resetForm()}>
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                  value={amount ? Number(amount.replace(/[^0-9]/g, '')).toLocaleString('id-ID') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setAmount(value);
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
                <Label htmlFor="source">
                  Source of Funds
                </Label>
                <Select value={sourceOfFundsId} onValueChange={setSourceOfFundsId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select funding source">
                      {sourceOfFundsId && sourceOfFundsId !== 'none' && (() => {
                        const selectedFund = funds.find(f => f.id === sourceOfFundsId);
                        if (selectedFund) {
                          return (
                            <div className="flex items-center gap-2">
                              {selectedFund.image_url ? (
                                <Image 
                                  src={selectedFund.image_url} 
                                  alt={selectedFund.name}
                                  width={16}
                                  height={16}
                                  className="w-4 h-4 rounded-sm object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                              ) : null}
                              <div className={`w-4 h-4 bg-gradient-to-br from-teal-500 to-teal-600 rounded-sm flex items-center justify-center text-white font-bold text-xs ${selectedFund.image_url ? 'hidden' : ''}`}>
                                {selectedFund.name.substring(0, 1).toUpperCase()}
                              </div>
                              {selectedFund.name}
                            </div>
                          );
                        }
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No funding source</SelectItem>
                    {funds.filter(fund => fund.status === 'Active').map((fund) => (
                      <SelectItem key={fund.id} value={fund.id}>
                        <div className="flex items-center gap-2">
                          {fund.image_url ? (
                            <Image 
                              src={fund.image_url} 
                              alt={fund.name}
                              width={16}
                              height={16}
                              className="w-4 h-4 rounded-sm object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-4 h-4 bg-gradient-to-br from-teal-500 to-teal-600 rounded-sm flex items-center justify-center text-white font-bold text-xs ${fund.image_url ? 'hidden' : ''}`}>
                            {fund.name.substring(0, 1).toUpperCase()}
                          </div>
                          {fund.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Destination Fund Selector - Only show for Internal Transfer expense transactions */}
              {isInternalTransfer() && type === 'expense' && (
                <div className="space-y-2">
                  <Label htmlFor="destination">Destination Fund *</Label>
                  <Select value={destinationFundId} onValueChange={setDestinationFundId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination fund">
                        {destinationFundId && destinationFundId !== 'none' && (() => {
                          const selectedFund = funds.find(f => f.id === destinationFundId);
                          if (selectedFund) {
                            return (
                              <div className="flex items-center gap-2">
                                {selectedFund.image_url ? (
                                  <Image 
                                    src={selectedFund.image_url} 
                                    alt={selectedFund.name}
                                    width={16}
                                    height={16}
                                    className="w-4 h-4 rounded-sm object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                    }}
                                  />
                                ) : null}
                                <div className={`w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-sm flex items-center justify-center text-white font-bold text-xs ${selectedFund.image_url ? 'hidden' : ''}`}>
                                  {selectedFund.name.substring(0, 1).toUpperCase()}
                                </div>
                                {selectedFund.name}
                              </div>
                            );
                          }
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {funds.filter(fund => fund.status === 'Active' && fund.id !== sourceOfFundsId).map((fund) => (
                        <SelectItem key={fund.id} value={fund.id}>
                          <div className="flex items-center gap-2">
                            {fund.image_url ? (
                              <Image 
                                src={fund.image_url} 
                                alt={fund.name}
                                width={16}
                                height={16}
                                className="w-4 h-4 rounded-sm object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            <div className={`w-4 h-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-sm flex items-center justify-center text-white font-bold text-xs ${fund.image_url ? 'hidden' : ''}`}>
                              {fund.name.substring(0, 1).toUpperCase()}
                            </div>
                            {fund.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
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
              {transactions.length === 0 && (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Transaction
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Card View */}
              <div className="hidden md:block space-y-3 p-4">
                {filteredTransactions.map((transaction) => (
                  <div 
                    key={transaction.id} 
                    className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-all duration-200"
                    onClick={() => {
                      setViewingTransaction(transaction)
                      setIsDetailsDialogOpen(true)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      handleEdit(transaction)
                    }}
                    onTouchStart={(e) => {
                      const touchStartTime = Date.now()
                      const startX = e.touches[0].clientX
                      const startY = e.touches[0].clientY
                      let hasMoved = false
                      
                      const timeoutId = setTimeout(() => {
                        if (!hasMoved) {
                          handleEdit(transaction)
                        }
                      }, 500)
                      
                      const handleTouchMove = (moveEvent: TouchEvent) => {
                        const moveX = moveEvent.touches[0].clientX
                        const moveY = moveEvent.touches[0].clientY
                        const deltaX = Math.abs(moveX - startX)
                        const deltaY = Math.abs(moveY - startY)
                        
                        if (deltaX > 10 || deltaY > 10) {
                          hasMoved = true
                          clearTimeout(timeoutId)
                        }
                      }
                      
                      const handleTouchEnd = () => {
                        clearTimeout(timeoutId)
                        if (Date.now() - touchStartTime < 500 && !hasMoved) {
                          setViewingTransaction(transaction)
                          setIsDetailsDialogOpen(true)
                        }
                        if (e.currentTarget) {
                          e.currentTarget.removeEventListener('touchend', handleTouchEnd)
                          e.currentTarget.removeEventListener('touchmove', handleTouchMove)
                        }
                      }
                      
                      if (e.currentTarget) {
                        e.currentTarget.addEventListener('touchend', handleTouchEnd)
                        e.currentTarget.addEventListener('touchmove', handleTouchMove)
                      }
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex-1">
                        <div className="text-sm text-gray-500 mb-1 flex items-center gap-1">
                          {(() => {
                            const fund = transaction.source_of_funds_id ? funds.find(f => f.id === transaction.source_of_funds_id) : null;
                            if (fund) {
                              return (
                                <>
                                  {fund.image_url ? (
                                    <Image 
                                      src={fund.image_url} 
                                      alt={fund.name}
                                      width={12}
                                      height={12}
                                      className="w-3 h-3 rounded-sm object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-3 h-3 bg-gradient-to-br from-teal-500 to-teal-600 rounded-sm flex items-center justify-center text-white font-bold text-[8px] ${fund.image_url ? 'hidden' : ''}`}>
                                    {fund.name.substring(0, 1).toUpperCase()}
                                  </div>
                                </>
                              );
                            }
                            return <Wallet className="w-3 h-3" />;
                          })()} 
                          {transaction.source_of_funds_id ? funds.find(f => f.id === transaction.source_of_funds_id)?.name || 'Unknown Fund' : 'No Fund'}
                        </div>
                        <div className="font-semibold text-gray-900 text-base mb-1">{getCategoryDisplayName(transaction.category)}</div>
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
                    onClick={() => {
                      setViewingTransaction(transaction)
                      setIsDetailsDialogOpen(true)
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      handleEdit(transaction)
                    }}
                    onTouchStart={(e) => {
                      const touchStartTime = Date.now()
                      const startX = e.touches[0].clientX
                      const startY = e.touches[0].clientY
                      let hasMoved = false
                      
                      const timeoutId = setTimeout(() => {
                        if (!hasMoved) {
                          handleEdit(transaction)
                        }
                      }, 500)
                      
                      const handleTouchMove = (moveEvent: TouchEvent) => {
                        const moveX = moveEvent.touches[0].clientX
                        const moveY = moveEvent.touches[0].clientY
                        const deltaX = Math.abs(moveX - startX)
                        const deltaY = Math.abs(moveY - startY)
                        
                        if (deltaX > 10 || deltaY > 10) {
                          hasMoved = true
                          clearTimeout(timeoutId)
                        }
                      }
                      
                      const handleTouchEnd = () => {
                        clearTimeout(timeoutId)
                        if (Date.now() - touchStartTime < 500 && !hasMoved) {
                          setViewingTransaction(transaction)
                          setIsDetailsDialogOpen(true)
                        }
                        if (e.currentTarget) {
                          e.currentTarget.removeEventListener('touchend', handleTouchEnd)
                          e.currentTarget.removeEventListener('touchmove', handleTouchMove)
                        }
                      }
                      
                      if (e.currentTarget) {
                        e.currentTarget.addEventListener('touchend', handleTouchEnd)
                        e.currentTarget.addEventListener('touchmove', handleTouchMove)
                      }
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-sm text-gray-500 mb-2 flex items-center gap-1">
                          {(() => {
                            const fund = transaction.source_of_funds_id ? funds.find(f => f.id === transaction.source_of_funds_id) : null;
                            if (fund) {
                              return (
                                <>
                                  {fund.image_url ? (
                                    <Image 
                                      src={fund.image_url} 
                                      alt={fund.name}
                                      width={12}
                                      height={12}
                                      className="w-3 h-3 rounded-sm object-cover"
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                  ) : null}
                                  <div className={`w-3 h-3 bg-gradient-to-br from-teal-500 to-teal-600 rounded-sm flex items-center justify-center text-white font-bold text-[8px] ${fund.image_url ? 'hidden' : ''}`}>
                                    {fund.name.substring(0, 1).toUpperCase()}
                                  </div>
                                </>
                              );
                            }
                            return <Wallet className="w-3 h-3" />;
                          })()} 
                          {transaction.source_of_funds_id ? funds.find(f => f.id === transaction.source_of_funds_id)?.name || 'Unknown Fund' : 'No Fund'}
                        </div>
                        <div className="font-semibold text-gray-900 text-sm mb-1">{getCategoryDisplayName(transaction.category)}</div>
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
      

      
      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{transactionToDelete?.description}&quot;? This action cannot be undone.
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

      {/* Transaction Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {viewingTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Type</Label>
                  <p className={`text-sm font-semibold ${
                    viewingTransaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {viewingTransaction.type === 'income' ? 'Income' : 'Expense'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Amount</Label>
                  <p className={`text-sm font-semibold ${
                    viewingTransaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {viewingTransaction.type === 'income' ? '+' : '-'}{formatIDR(viewingTransaction.amount)}
                  </p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-600">Category</Label>
                <p className="text-sm">{getCategoryName(viewingTransaction.category)}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                  {(() => {
                    const fund = viewingTransaction.source_of_funds_id ? funds.find(f => f.id === viewingTransaction.source_of_funds_id) : null;
                    if (fund) {
                      return (
                        <>
                          {fund.image_url ? (
                            <Image 
                              src={fund.image_url} 
                              alt={fund.name}
                              width={16}
                              height={16}
                              className="w-4 h-4 rounded-sm object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : null}
                          <div className={`w-4 h-4 bg-gradient-to-br from-teal-500 to-teal-600 rounded-sm flex items-center justify-center text-white font-bold text-xs ${fund.image_url ? 'hidden' : ''}`}>
                            {fund.name.substring(0, 1).toUpperCase()}
                          </div>
                        </>
                      );
                    }
                    return <Wallet className="w-4 h-4" />;
                  })()} 
                  Fund
                </Label>
                <p className="text-sm">
                  {viewingTransaction.source_of_funds_id 
                    ? funds.find(f => f.id === viewingTransaction.source_of_funds_id)?.name || 'Unknown Fund' 
                    : 'No Fund'}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Date</Label>
                  <p className="text-sm">{new Date(viewingTransaction.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Status</Label>
                  <p className={`text-sm font-medium ${
                    viewingTransaction.status === 'paid' ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {viewingTransaction.status === 'paid' ? 'Paid' : 'Unpaid'}
                  </p>
                </div>
              </div>
              
              {viewingTransaction.note && (
                <div>
                  <Label className="text-sm font-medium text-gray-600">Note</Label>
                  <p className="text-sm text-gray-700">{viewingTransaction.note}</p>
                </div>
              )}
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setIsDetailsDialogOpen(false)
                  handleEdit(viewingTransaction)
                }}>
                  Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Sync Internal Transfer Confirmation Dialog */}
      <Dialog open={isSyncConfirmDialogOpen} onOpenChange={setIsSyncConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sync Internal Transfer</DialogTitle>
            <DialogDescription>
              This is an Internal Transfer transaction. Editing it will also update the corresponding {editingTransaction?.type === 'expense' ? 'income' : 'expense'} transaction. Do you want to proceed with synchronized editing?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setIsSyncConfirmDialogOpen(false)
                setEditingTransaction(null)
                setLinkedTransaction(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setIsSyncConfirmDialogOpen(false)
                if (editingTransaction) {
                  proceedWithEdit(editingTransaction)
                }
              }}
            >
              Proceed with Sync
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  )
}