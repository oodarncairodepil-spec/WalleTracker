'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
// import { Checkbox } from './ui/checkbox' // Temporarily commented out
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { fundsService } from '../services/funds-service'
import type { Fund } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'
import { formatIDR } from '../lib/utils'

export function FundsPage() {
  const { user } = useAuth()
  const [funds, setFunds] = useState<Fund[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingFund, setEditingFund] = useState<Fund | null>(null)
  const [fundToDelete, setFundToDelete] = useState<Fund | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  
  // Form state
  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [status, setStatus] = useState('Active')
  const [isDefault, setIsDefault] = useState(false)

  useEffect(() => {
    if (user) {
      loadFunds()
    }
  }, [user])

  const loadFunds = async () => {
    try {
      setLoading(true)
      const fundsData = await fundsService.getFunds()
      setFunds(fundsData)
    } catch (error) {
      console.error('Error loading funds:', error)
      toast.error('Failed to load funds')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim() || !balance) {
      toast.error('Please fill in all fields')
      return
    }

    const balanceAmount = parseInt(balance, 10)
    if (isNaN(balanceAmount) || balanceAmount < 0) {
      toast.error('Please enter a valid balance amount')
      return
    }

    // Check if balance exceeds database limit
    if (balanceAmount > 999999999999) {
      toast.error('Balance amount cannot exceed 999,999,999,999')
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
        toast.success('Fund updated successfully')
      } else {
        // Create new fund
        await fundsService.createFund({
          name: name.trim(),
          balance: balanceAmount,
          image_url: imageUrl.trim() || undefined,
          status: status,
          is_default: isDefault
        })
        toast.success('Fund created successfully')
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
      toast.error('Failed to save fund')
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

  const handleDelete = (fund: Fund) => {
    setFundToDelete(fund)
    setIsDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!fundToDelete) return

    try {
      await fundsService.deleteFund(fundToDelete.id)
      toast.success('Fund deleted successfully')
      await loadFunds()
    } catch (error) {
      console.error('Error deleting fund:', error)
      toast.error('Failed to delete fund')
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

  if (loading) {
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
        <DialogContent>
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
                  value={balance}
                  onChange={(e) => {
                    setBalance(e.target.value);
                  }}
                  onBlur={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    if (!isNaN(Number(value)) || value === '') {
                      setBalance(value);
                    }
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
              onClick={() => handleEdit(fund)}
            >
              <CardHeader className="p-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {fund.image_url ? (
                      <img 
                        src={fund.image_url} 
                        alt={fund.name}
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
                    <div>
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
                    <p className="text-xs font-semibold text-gray-900">{formatCurrency(fund.balance)}</p>
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
              Are you sure you want to delete "{fundToDelete?.name}"? This action cannot be undone.
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
    </div>
  )
}