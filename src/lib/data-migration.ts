import { transactionService } from './supabase-service'
import { Transaction } from './supabase'
import { toast } from 'sonner'

// Local storage key for transactions
const LOCAL_STORAGE_KEY = 'walletracker-transactions'

// Get transactions from local storage
export function getLocalStorageTransactions(): Transaction[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error reading from localStorage:', error)
    return []
  }
}

// Save transactions to local storage
export function saveToLocalStorage(transactions: Transaction[]) {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(transactions))
  } catch (error) {
    console.error('Error saving to localStorage:', error)
  }
}

// Clear local storage transactions
export function clearLocalStorage() {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
  } catch (error) {
    console.error('Error clearing localStorage:', error)
  }
}

// Migrate local storage data to Supabase
export async function migrateLocalDataToSupabase(): Promise<{ success: boolean; migratedCount: number; errors: string[] }> {
  const localTransactions = getLocalStorageTransactions()
  
  if (localTransactions.length === 0) {
    return { success: true, migratedCount: 0, errors: [] }
  }

  const errors: string[] = []
  let migratedCount = 0

  // Migrate each transaction
  for (const transaction of localTransactions) {
    try {
      // Remove local-only fields and prepare for Supabase
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { created_at, updated_at, user_id, ...cleanTransaction } = transaction
      
      const { error } = await transactionService.addTransaction(cleanTransaction)
      
      if (error) {
        errors.push(`Failed to migrate transaction: ${transaction.description} - ${error.message}`)
      } else {
        migratedCount++
      }
    } catch (error) {
      errors.push(`Error migrating transaction: ${transaction.description} - ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const success = errors.length === 0
  
  // If migration was successful, clear local storage
  if (success) {
    clearLocalStorage()
    toast.success(`Successfully migrated ${migratedCount} transactions to your account!`, { duration: 1000 })
  } else {
    toast.error(`Migration completed with ${errors.length} errors. ${migratedCount} transactions were migrated successfully.`, { duration: 1000 })
  }

  return { success, migratedCount, errors }
}

// Check if there's local data that needs migration
export function hasLocalDataToMigrate(): boolean {
  const localTransactions = getLocalStorageTransactions()
  return localTransactions.length > 0
}

// Backup current Supabase data to local storage (for offline use)
export async function backupSupabaseDataToLocal(): Promise<boolean> {
  try {
    const { data: transactions, error } = await transactionService.getTransactions()
    
    if (error) {
      console.error('Error fetching transactions for backup:', error)
      return false
    }

    if (transactions) {
      saveToLocalStorage(transactions)
      return true
    }
    
    return false
  } catch (error) {
    console.error('Error backing up data to local storage:', error)
    return false
  }
}