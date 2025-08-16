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
    } catch (error: unknown) {
      // Handle auth session errors gracefully
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Auth session missing') || errorMessage.includes('session_not_found')) {
        // Treat as successful signout if session is already missing
        return { error: null }
      }
      return { error: error instanceof Error ? error : new Error(String(error)) }
    }
  },



  // Get current user
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        // Handle refresh token errors gracefully
        if (error.message.includes('refresh_token_not_found') || error.message.includes('Invalid Refresh Token')) {
          console.warn('Refresh token invalid, user needs to sign in again')
          await supabase.auth.signOut()
          return null
        }
        throw error
      }
      return user
    } catch (error) {
      console.warn('Error getting current user:', error)
      return null
    }
  },

  // Listen to auth changes
  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      // Handle auth errors gracefully
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('Token refresh failed, signing out user')
      }
      if (event === 'SIGNED_OUT' || !session) {
        callback(null)
      } else {
        callback(session.user)
      }
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