import { supabase } from '../lib/supabase'
import type { Fund } from '../lib/supabase'

export class FundsService {
  async getFunds(): Promise<Fund[]> {
    console.log('[FUNDS DEBUG] getFunds called')
    try {
      // Check if user is authenticated first
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.log('[FUNDS DEBUG] No authenticated user, returning empty array')
        return []
      }
      
      console.log('[FUNDS DEBUG] Making Supabase request to funds table')
      const { data, error } = await supabase
        .from('funds')
        .select('*')
        .order('created_at', { ascending: false })

      console.log('[FUNDS DEBUG] Supabase response - data:', data ? `${data.length} items` : 'null', 'error:', error)

      if (error) {
        console.error('[FUNDS DEBUG] Error fetching funds:', error)
        throw new Error(`Failed to fetch funds: ${error.message}`)
      }

      console.log('[FUNDS DEBUG] Successfully fetched funds:', data?.length || 0)
      return data || []
    } catch (err) {
      console.error('[FUNDS DEBUG] Exception in getFunds:', err)
      throw err
    }
  }

  async createFund(fund: Omit<Fund, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Fund> {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await supabase
      .from('funds')
      .insert({
        ...fund,
        user_id: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating fund:', error)
      throw new Error(`Failed to create fund: ${error.message}`)
    }

    return data
  }

  async updateFund(id: string, updates: Partial<Omit<Fund, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<Fund> {
    const { data, error } = await supabase
      .from('funds')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating fund:', error)
      throw new Error(`Failed to update fund: ${error.message}`)
    }

    return data
  }

  async deleteFund(id: string): Promise<void> {
    const { error } = await supabase
      .from('funds')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting fund:', error)
      throw new Error(`Failed to delete fund: ${error.message}`)
    }
  }

  async getTotalBalance(): Promise<number> {
    console.log('[FUNDS DEBUG] getTotalBalance called')
    try {
      const funds = await this.getFunds()
      console.log('[FUNDS DEBUG] Got funds for total balance calculation:', funds.length)
      const activeFunds = funds.filter(fund => fund.status === 'Active')
      console.log('[FUNDS DEBUG] Active funds:', activeFunds.length)
      const total = activeFunds.reduce((total, fund) => total + fund.balance, 0)
      console.log('[FUNDS DEBUG] Total balance calculated:', total)
      return total
    } catch (err) {
      console.error('[FUNDS DEBUG] Exception in getTotalBalance:', err)
      throw err
    }
  }

  async updateFundBalance(id: string, amount: number, operation: 'add' | 'subtract'): Promise<Fund> {
    const fund = await this.getFundById(id)
    const newBalance = operation === 'add' 
      ? fund.balance + amount 
      : fund.balance - amount

    return this.updateFund(id, { balance: newBalance })
  }

  async getFundById(id: string): Promise<Fund> {
    const { data, error } = await supabase
      .from('funds')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching fund:', error)
      throw new Error(`Failed to fetch fund: ${error.message}`)
    }

    return data
  }

  async getDefaultFund(): Promise<Fund | null> {
    const { data, error } = await supabase
      .from('funds')
      .select('*')
      .eq('is_default', true)
      .single()

    if (error) {
      // No default fund found is not an error
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('Error fetching default fund:', error)
      throw new Error(`Failed to fetch default fund: ${error.message}`)
    }

    return data
  }

  async setDefaultFund(id: string): Promise<Fund> {
    const { data, error } = await supabase
      .from('funds')
      .update({ is_default: true })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error setting default fund:', error)
      throw new Error(`Failed to set default fund: ${error.message}`)
    }

    return data
  }

  async unsetDefaultFund(id: string): Promise<Fund> {
    const { data, error } = await supabase
      .from('funds')
      .update({ is_default: false })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error unsetting default fund:', error)
      throw new Error(`Failed to unset default fund: ${error.message}`)
    }

    return data
  }
}

export const fundsService = new FundsService()