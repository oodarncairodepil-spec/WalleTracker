import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

console.log('[SUPABASE DEBUG] Configuration:')
console.log('[SUPABASE DEBUG] URL:', supabaseUrl)
console.log('[SUPABASE DEBUG] Key configured:', supabaseAnonKey !== 'placeholder-key')
console.log('[SUPABASE DEBUG] Is configured:', supabaseUrl !== 'https://placeholder.supabase.co' && supabaseAnonKey !== 'placeholder-key')

// Create a mock client if environment variables are not set
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Check if Supabase is properly configured
export const isSupabaseConfigured = () => {
  return supabaseUrl !== 'https://placeholder.supabase.co' && supabaseAnonKey !== 'placeholder-key'
}

// Test Supabase connection
export const testSupabaseConnection = async () => {
  try {
    const { error } = await supabase.from('profiles').select('count').limit(1)
    if (error) {
      console.error('Supabase connection test failed:', error)
      return false
    }
    console.log('Supabase connection test successful')
    return true
  } catch (error) {
    console.error('Supabase connection test error:', error instanceof Error ? error.message : String(error))
    return false
  }
}

// Database types
export interface Fund {
  id: string
  user_id: string
  name: string
  balance: number
  image_url?: string
  status?: string
  is_default?: boolean
  created_at?: string
  updated_at?: string
}

export interface Transaction {
  id: string
  amount: number
  description: string
  category: string
  category_id?: string
  type: 'income' | 'expense'
  date: string
  source_of_funds_id?: string
  destination_fund_id?: string // For internal transfers
  status: 'paid' | 'unpaid'
  note?: string
  created_at?: string
  updated_at?: string
  user_id?: string
  fund?: Fund // For joined queries
  category_data?: Category // For joined queries
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: 'income' | 'expense'
  budget_amount: number
  budget_period: 'monthly' | 'weekly' | '10days'
  is_active: boolean
  parent_id?: string
  created_at?: string
  updated_at?: string
}

// New interfaces for separate tables approach
export interface MainCategory {
  id: string
  user_id: string
  name: string
  type: 'income' | 'expense'
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface Subcategory {
  id: string
  user_id: string
  main_category_id: string
  name: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface Profile {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  created_at?: string
  updated_at?: string
}

export interface OpenAIResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface ExtractedTransaction {
  amount: number
  description: string
  category: string
  type: 'income' | 'expense'
  date: string
  note?: string
}

export interface ParsedImageRecord {
  id: string
  user_id: string
  record_id: string
  timestamp: string // ISO string format
  image_data: string // base64 encoded image
  openai_response?: OpenAIResponse
  extracted_json?: ExtractedTransaction[]
  status: 'success' | 'error'
  error_message?: string
  created_at?: string
  updated_at?: string
}

// Budget-related interfaces
export interface Budget {
  id: string
  user_id: string
  period_start_date: string // ISO date string
  period_end_date: string   // ISO date string
  period_type: 'monthly' | 'weekly' | 'yearly' | 'custom'
  main_category_id?: string
  subcategory_id?: string
  category_name: string
  category_type: 'income' | 'expense'
  budgeted_amount: number
  actual_amount: number
  variance_amount: number
  variance_percentage: number
  is_active: boolean
  is_finalized: boolean
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface BudgetHistory {
  id: string
  user_id: string
  period_start_date: string
  period_end_date: string
  period_type: 'monthly' | 'weekly' | 'yearly' | 'custom'
  period_description?: string
  main_category_id?: string
  subcategory_id?: string
  category_name: string
  category_type: 'income' | 'expense'
  budgeted_amount: number
  actual_amount: number
  variance_amount: number
  variance_percentage: number
  performance_status: 'surplus' | 'deficit' | 'on_target'
  notes?: string
  finalized_at: string
  created_at?: string
}

export interface BudgetPerformanceSummary {
  user_id: string
  period_start_date: string
  period_end_date: string
  category_type: 'income' | 'expense'
  total_categories: number
  total_budgeted: number
  total_actual: number
  total_variance: number
  avg_variance_percentage: number
  categories_over_budget: number
  categories_under_budget: number
  categories_on_target: number
}