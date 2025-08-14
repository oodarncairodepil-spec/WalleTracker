import { supabase, Transaction, Profile } from './supabase'
import { User } from '@supabase/supabase-js'

// Authentication functions
export const authService = {
  // Sign up with email and password
  async signUp(email: string, password: string, fullName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    return { data, error }
  },

  // Sign in with email and password
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  // Sign out
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch (error: any) {
      // Handle auth session errors gracefully
      if (error?.message?.includes('Auth session missing') || error?.message?.includes('session_not_found')) {
        // Treat as successful signout if session is already missing
        return { error: null }
      }
      return { error }
    }
  },



  // Get current user
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  },

  // Listen to auth changes
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user ?? null)
    })
  },
}

// Transaction functions
export const transactionService = {
  // Get all transactions for the current user
  async getTransactions(): Promise<{ data: Transaction[] | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
    
    return { data, error }
  },

  // Add a new transaction
  async addTransaction(transaction: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'user_id'>): Promise<{ data: Transaction | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('transactions')
      .insert([transaction])
      .select()
      .single()
    
    return { data, error }
  },

  // Update a transaction
  async updateTransaction(id: string, updates: Partial<Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'user_id'>>): Promise<{ data: Transaction | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    return { data, error }
  },

  // Delete a transaction
  async deleteTransaction(id: string): Promise<{ error: Error | null }> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
    
    return { error }
  },

  // Get transactions by category
  async getTransactionsByCategory(category: string): Promise<{ data: Transaction[] | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('category', category)
      .order('date', { ascending: false })
    
    return { data, error }
  },

  // Get transactions by type (income/expense)
  async getTransactionsByType(type: 'income' | 'expense'): Promise<{ data: Transaction[] | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('type', type)
      .order('date', { ascending: false })
    
    return { data, error }
  },

  // Get transactions by date range
  async getTransactionsByDateRange(startDate: string, endDate: string): Promise<{ data: Transaction[] | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
    
    return { data, error }
  },
}

// Profile functions
export const profileService = {
  // Get user profile
  async getProfile(): Promise<{ data: Profile | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .single()
    
    return { data, error }
  },

  // Update user profile
  async updateProfile(updates: { full_name?: string; avatar_url?: string }): Promise<{ data: Profile | null; error: Error | null }> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .select()
      .single()
    
    return { data, error }
  },
}