'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
// import { Checkbox } from './ui/checkbox' // Temporarily commented out
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from 'sonner'
import { Plus, Download } from 'lucide-react'
import { fundsService } from '../services/funds-service'
import { transactionService } from '../services/transaction-service'
import type { Fund, Transaction } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'
import { formatIDR } from '../lib/utils'

export function FundsPage() {
  const { user, loading: authLoading } = useAuth()
  const [funds, setFunds] = useState<Fund[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingFund, setEditingFund] = useState<Fund | null>(null)
  const [fundToDelete, setFundToDelete] = useState<Fund | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false)
  const [viewingFund, setViewingFund] = useState<Fund | null>(null)
  const [fundTransactions, setFundTransactions] = useState<Transaction[]>([])
  
  // Form state
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [status, setStatus] = useState('Active')
  const [isDefault, setIsDefault] = useState(false)

  useEffect(() => {
    if (user) {
      loadFunds()
    } else if (!authLoading) {
      // If no user and auth is not loading, set loading to false
      setLoading(false)
    }
  }, [user, authLoading])

  const loadFunds = async () => {
    try {
      setLoading(true)
      const fundsData = await fundsService.getFunds()
      setFunds(fundsData)
    } catch (error) {
      console.error('Error loading funds:', error)
      toast.error('Failed to load funds', { duration: 1000 })
    } finally {
      setLoading(false)
    }
  }

  const loadFundTransactions = async (fundId: string) => {
    try {
      const transactions = await transactionService.getTransactions()
      const fundTransactions = transactions
        .filter(t => t.source_of_funds_id === fundId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10) // Last 10 transactions
      setFundTransactions(fundTransactions)
    } catch (error) {
      console.error('Error loading fund transactions:', error)
      toast.error('Failed to load transactions', { duration: 1000 })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !balance) {
      toast.error('Please fill in all fields', { duration: 1000 })
      return
    }

    const balanceAmount = parseInt(balance, 10)
    if (isNaN(balanceAmount) || balanceAmount < 0) {
      toast.error('Please enter a valid balance amount', { duration: 1000 })
      return
    }

    // Check if balance exceeds database limit
    if (balanceAmount > 999999999999) {
      toast.error('Balance amount cannot exceed 999,999,999,999', { duration: 1000 })
      return
    }

    try {
      if (editingFund) {
        // Update existing fund
        await fundsService.updateFund(editingFund.id, {
          name: name.trim(),
          balance: balanceAmount,
          image_url: imageUrl.trim() || undefined,
          status: status,
          is_default: isDefault
        })
        toast.success('Fund updated successfully', { duration: 1000 })
      } else {
        // Create new fund
        await fundsService.createFund({
          name: name.trim(),
          balance: balanceAmount,
          image_url: imageUrl.trim() || undefined,
          status: status,
          is_default: isDefault
        })
        toast.success('Fund created successfully', { duration: 1000 })
      }
      
      // Reset form and close dialog
      setName('')
      setBalance('')
      setImageUrl('')
      setStatus('Active')
      setIsDefault(false)
      setEditingFund(null)
      setIsDialogOpen(false)
      
      // Reload funds
      await loadFunds()
    } catch (error) {
      console.error('Error saving fund:', error)
      toast.error('Failed to save fund', { duration: 1000 })
    }
  }

  const handleEdit = (fund: Fund) => {
    setEditingFund(fund)
    setName(fund.name)
    setBalance(fund.balance.toString())
    setImageUrl(fund.image_url || '')
    setStatus(fund.status || 'Active')
    setIsDefault(fund.is_default || false)
    setIsDialogOpen(true)
  }



  const confirmDelete = async () => {
    if (!fundToDelete) return

    try {
      await fundsService.deleteFund(fundToDelete.id)
      toast.success('Fund deleted successfully', { duration: 1000 })
      await loadFunds()
    } catch (error) {
      console.error('Error deleting fund:', error)
      toast.error('Failed to delete fund', { duration: 1000 })
    }
    setIsDeleteDialogOpen(false)
    setFundToDelete(null)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingFund(null)
    setName('')
    setBalance('')
    setImageUrl('')
    setStatus('Active')
    setIsDefault(false)
  }

  const formatCurrency = (amount: number) => {
    return formatIDR(amount)
  }

  const getTotalBalance = () => {
    return funds
      .filter(fund => fund.status === 'Active')
      .reduce((total, fund) => total + fund.balance, 0)
  }

  const handleDownloadCSV = async (fund: Fund) => {
    try {
      // Fetch all transactions and filter by fund
      const allTransactions = await transactionService.getTransactions()
      const fundTransactions = allTransactions.filter((t: Transaction) => t.source_of_funds_id === fund.id)
      
      if (fundTransactions.length === 0) {
        toast.error('No transactions found for this fund', { duration: 2000 })
        return
      }

      // Sort transactions by date (oldest first) to calculate running balance correctly
      const sortedTransactions = fundTransactions.sort((a: Transaction, b: Transaction) => new Date(a.date).getTime() - new Date(b.date).getTime())
      
      // Calculate running balance for each transaction
      let runningBalance = 0
      const transactionsWithBalance = sortedTransactions.map((transaction: Transaction) => {
        if (transaction.type === 'income') {
          runningBalance += transaction.amount
        } else {
          runningBalance -= transaction.amount
        }
        
        return {
          ...transaction,
          runningBalance
        }
      })
      
      // Keep transactions sorted by date ascending for CSV output (oldest first)
      const csvTransactions = transactionsWithBalance
      
      // Create CSV content
      const csvHeader = 'Date,Type,Amount,Description,Status,Running Balance\n'
      const csvRows = csvTransactions.map((transaction: Transaction & { runningBalance: number }) => {
        const date = new Date(transaction.date).toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric', 
          year: 'numeric'
        })
        const type = transaction.type === 'income' ? 'Income' : 'Expense'
        const amount = transaction.amount
        const description = `"${transaction.description.replace(/"/g, '""')}"`
        const status = transaction.status === 'paid' ? 'Paid' : 'Unpaid'
        const balance = transaction.runningBalance
        
        return `${date},${type},${amount},${description},${status},${balance}`
      }).join('\n')
      
      const csvContent = csvHeader + csvRows
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `${fund.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_transactions.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(`CSV exported successfully for ${fund.name}`, { duration: 2000 })
    } catch (error) {
      console.error('Error exporting CSV:', error)
      toast.error('Failed to export CSV', { duration: 2000 })
    }
  }

  if (loading || authLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-32 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Fund</h1>
          <div className="w-10 h-10"></div> {/* Spacer for avatar */}
        </div>
      </div>
      
      <div className="px-6 space-y-6">
      {/* Total Balance Card */}
      <div className="relative bg-white rounded-lg p-2 shadow-sm border hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-medium text-gray-600">Total Balance</h2>
            <div className={`text-base font-bold ${
              getTotalBalance() >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(getTotalBalance())}
            </div>
          </div>
        </div>
      </div>
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-800">Your Funds</h1>
        
        {/* Add Button */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleDialogClose()} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </DialogTrigger>
        </Dialog>
      </div>
      
      {/* Dialog Content for Add/Edit */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingFund ? 'Edit Fund' : 'Add New Fund'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Fund Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="e.g., Checking Account, Savings, Cash"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="balance">Initial Balance</Label>
                <Input
                  id="balance"
                  type="text"
                  placeholder="0"
                  value={balance ? Number(balance).toLocaleString('id-ID') : ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    setBalance(value);
                  }}
                  required
                />
                <p className="text-xs text-gray-500">Maximum: 999,999,999,999</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                <Input
                  id="imageUrl"
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Not Active">Not Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox"
                  id="isDefault" 
                  checked={isDefault} 
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <Label htmlFor="isDefault" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Set as default fund
                </Label>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingFund ? 'Update Fund' : 'Create Fund'}
                </Button>
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      {/* Funds List */}
      {funds.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 px-6">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="w-6 h-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No funds yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first funding source to start tracking your finances
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Fund
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-1">
          {funds.map((fund) => (
            <Card 
              key={fund.id} 
              className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm" 
              onClick={async () => {
                setViewingFund(fund)
                await loadFundTransactions(fund.id)
                setIsDetailsDialogOpen(true)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                handleEdit(fund)
              }}
              onTouchStart={(e) => {
                const touchStartTime = Date.now()
                const startX = e.touches[0].clientX
                const startY = e.touches[0].clientY
                let hasMoved = false
                
                const timeoutId = setTimeout(() => {
                  if (!hasMoved) {
                    handleEdit(fund)
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
                    setViewingFund(fund)
                    loadFundTransactions(fund.id)
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
              <CardHeader className="p-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {fund.image_url ? (
                      <Image 
                        src={fund.image_url} 
                        alt={fund.name}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded-md object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-6 h-6 bg-gradient-to-br from-teal-500 to-teal-600 rounded-md flex items-center justify-center text-white font-bold text-xs ${fund.image_url ? 'hidden' : ''}`}>
                      {fund.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xs font-medium text-gray-800">{fund.name}</CardTitle>
                      {fund.is_default && (
                        <div className="flex items-center space-x-1">
                          <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-green-600 font-medium">Default</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatIDR(fund.balance)}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Fund</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{fundToDelete?.name}&quot;? This action cannot be undone.
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

      {/* Fund Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Fund Details</DialogTitle>
          </DialogHeader>
          {viewingFund && (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                {viewingFund.image_url ? (
                  <Image 
                    src={viewingFund.image_url} 
                    alt={viewingFund.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                    {viewingFund.name.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-lg">{viewingFund.name}</h3>
                  <p className="text-2xl font-bold text-gray-900">{formatIDR(viewingFund.balance)}</p>
                  {viewingFund.is_default && (
                    <div className="flex items-center space-x-1 mt-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-green-600 font-medium">Default Fund</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-600">Status</Label>
                <p className="text-sm">{viewingFund.status}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-600 mb-2 block">Recent Transactions (Last 10)</Label>
                {fundTransactions.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {fundTransactions.map((transaction) => (
                      <div key={transaction.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div>
                          <p className="text-sm font-medium">{transaction.description}</p>
                          <p className="text-xs text-gray-500">{new Date(transaction.date).toLocaleDateString()}</p>
                        </div>
                        <p className={`text-sm font-semibold ${
                          transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatIDR(transaction.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No transactions found for this fund</p>
                )}
              </div>
              
              <div className="flex justify-between space-x-2 pt-4">
                <Button variant="outline" onClick={() => handleDownloadCSV(viewingFund)}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
                    Close
                  </Button>
                  <Button onClick={() => {
                    setIsDetailsDialogOpen(false)
                    handleEdit(viewingFund)
                  }}>
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}