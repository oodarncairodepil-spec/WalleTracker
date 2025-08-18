import { supabase } from '../lib/supabase'
import type { Transaction } from '../lib/supabase'
import { fundsService } from './funds-service'

export class TransactionService {
  async getTransactions(): Promise<Transaction[]> {
    try {
      // Check if user is authenticated first
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('[TRANSACTIONS DEBUG] No authenticated user, returning empty array')
        return []
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          fund:funds(id, name, balance)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching transactions:', error)
        throw new Error(`Failed to fetch transactions: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Exception in getTransactions:', error)
      throw error
    }
  }

  async createTransaction(transaction: Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'fund'>): Promise<Transaction> {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Start a transaction to update both transaction and fund balance
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        ...transaction,
        user_id: user.id,
        status: transaction.status || 'paid'
      })
      .select(`
        *,
        fund:funds(id, name, balance)
      `)
      .single()

    if (error) {
      console.error('Error creating transaction:', error)
      throw new Error(`Failed to create transaction: ${error.message}`)
    }

    // Update fund balance if transaction is paid and has a source of funds
    if (data.status === 'paid' && data.source_of_funds_id) {
      try {
        const operation = data.type === 'income' ? 'add' : 'subtract'
        await fundsService.updateFundBalance(data.source_of_funds_id, data.amount, operation)
      } catch (error) {
        console.error('Error updating fund balance:', error)
        // Note: In a real app, you might want to rollback the transaction here
      }
    }

    return data
  }

  async updateTransaction(id: string, updates: Partial<Omit<Transaction, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'fund'>>): Promise<Transaction> {
    // Get the original transaction to compare changes
    const originalTransaction = await this.getTransactionById(id)
    
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        fund:funds(id, name, balance)
      `)
      .single()

    if (error) {
      console.error('Error updating transaction:', error)
      throw new Error(`Failed to update transaction: ${error.message}`)
    }

    // Handle fund balance updates based on status or amount changes
    await this.handleFundBalanceUpdate(originalTransaction, data)

    return data
  }

  async deleteTransaction(id: string): Promise<void> {
    console.log('TransactionService.deleteTransaction called with ID:', id)
    
    // Get the transaction before deleting to reverse fund balance changes
    console.log('Fetching transaction details before deletion...')
    const transaction = await this.getTransactionById(id)
    console.log('Transaction to delete:', transaction)
    
    console.log('Executing delete query...')
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Supabase delete error:', error)
      throw new Error(`Failed to delete transaction: ${error.message}`)
    }
    
    console.log('Transaction deleted from database successfully')

    // Reverse the fund balance change if the transaction was paid
    if (transaction.status === 'paid' && transaction.source_of_funds_id) {
      console.log('Reversing fund balance change...')
      console.log('Fund ID:', transaction.source_of_funds_id)
      console.log('Amount:', transaction.amount)
      console.log('Transaction type:', transaction.type)
      
      try {
        const operation = transaction.type === 'income' ? 'subtract' : 'add'
        console.log('Operation to perform:', operation)
        await fundsService.updateFundBalance(transaction.source_of_funds_id, transaction.amount, operation)
        console.log('Fund balance updated successfully')
      } catch (error) {
        console.error('Error reversing fund balance:', error)
      }
    } else {
      console.log('ℹ️ No fund balance update needed (transaction not paid or no fund specified)')
    }
    
    console.log('Transaction deletion completed successfully')
  }

  async getTransactionById(id: string): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        fund:funds(id, name, balance)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching transaction:', error)
      throw new Error(`Failed to fetch transaction: ${error.message}`)
    }

    return data
  }

  async getUnpaidExpenses(): Promise<Transaction[]> {
    try {
      // Check if user is authenticated first
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('[UNPAID EXPENSES DEBUG] No authenticated user, returning empty array')
        return []
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          fund:funds(id, name, balance)
        `)
        .eq('type', 'expense')
        .eq('status', 'unpaid')
        .order('date', { ascending: false })

      if (error) {
        console.error('Database error fetching unpaid expenses:', error)
        throw new Error(`Failed to fetch unpaid expenses: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Network error fetching unpaid expenses:', error)
      // Return empty array instead of throwing to prevent app crashes
      return []
    }
  }

  async getUnpaidExpensesTotal(): Promise<number> {
    try {
      const unpaidExpenses = await this.getUnpaidExpenses()
      
      // Internal transfer category IDs to exclude from calculations
      const internalTransferCategoryIds = [
        '90eae994-67f1-426e-a8bc-ff6e2dbab51c', // Other - Internal Transfer
        'ece52746-3984-4a1e-b8a4-dadfd916612e'  // Salary - Internal Transfer
      ]
      
      return unpaidExpenses
        .filter(expense => !internalTransferCategoryIds.includes(expense.category))
        .reduce((total, expense) => total + expense.amount, 0)
    } catch (error) {
      console.error('Error calculating unpaid expenses total:', error)
      return 0
    }
  }

  async getCategoryTotals(): Promise<Record<string, { income: number; expense: number; type: 'income' | 'expense'; count: number }>> {
    const transactions = await this.getTransactions()
    const categoryTotals: Record<string, { income: number; expense: number; type: 'income' | 'expense'; count: number }> = {}

    // Internal transfer category IDs to exclude from calculations
    const internalTransferCategoryIds = [
      '90eae994-67f1-426e-a8bc-ff6e2dbab51c', // Other - Internal Transfer
      'ece52746-3984-4a1e-b8a4-dadfd916612e'  // Salary - Internal Transfer
    ]

    transactions.forEach(transaction => {
      // Skip internal transfer transactions
      if (internalTransferCategoryIds.includes(transaction.category)) {
        return
      }

      if (!categoryTotals[transaction.category]) {
        categoryTotals[transaction.category] = {
          income: 0,
          expense: 0,
          type: transaction.type,
          count: 0
        }
      }
      
      categoryTotals[transaction.category].count += 1
      
      if (transaction.type === 'expense') {
        categoryTotals[transaction.category].expense += transaction.amount
      } else if (transaction.type === 'income') {
        categoryTotals[transaction.category].income += transaction.amount
      }
    })

    return categoryTotals
  }

  private async handleFundBalanceUpdate(original: Transaction, updated: Transaction): Promise<void> {
    // If status changed from unpaid to paid
    if (original.status === 'unpaid' && updated.status === 'paid' && updated.source_of_funds_id) {
      const operation = updated.type === 'income' ? 'add' : 'subtract'
      await fundsService.updateFundBalance(updated.source_of_funds_id, updated.amount, operation)
    }
    // If status changed from paid to unpaid
    else if (original.status === 'paid' && updated.status === 'unpaid' && original.source_of_funds_id) {
      const operation = original.type === 'income' ? 'subtract' : 'add'
      await fundsService.updateFundBalance(original.source_of_funds_id, original.amount, operation)
    }
    // If amount changed and transaction is paid
    else if (original.status === 'paid' && updated.status === 'paid' && original.amount !== updated.amount && updated.source_of_funds_id) {
      // Reverse original amount
      const reverseOperation = original.type === 'income' ? 'subtract' : 'add'
      await fundsService.updateFundBalance(updated.source_of_funds_id, original.amount, reverseOperation)
      
      // Apply new amount
      const newOperation = updated.type === 'income' ? 'add' : 'subtract'
      await fundsService.updateFundBalance(updated.source_of_funds_id, updated.amount, newOperation)
    }
  }
}

export const transactionService = new TransactionService()