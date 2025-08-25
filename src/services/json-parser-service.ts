import { supabase } from '../lib/supabase'

export interface ParsedJSONRecord {
  id: string
  user_id: string
  record_id: string
  timestamp: string
  json_input: string // Original JSON input
  extracted_data?: Record<string, unknown> // Extracted transaction data
  status: 'success' | 'error' | 'converted'
  error_message?: string
  created_at?: string
  updated_at?: string
}

export interface JSONParserOrderItem {
  id?: string
  bulk_order_id?: string
  item_name: string
  quantity: number
  unit_price: number
  total_price: number
  category: string
  subcategory?: string
  notes?: string
  created_at?: string
  updated_at?: string
}

export interface JSONParserOrder {
  id?: string
  user_id?: string
  title: string
  description?: string
  total_amount: number
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  source_of_funds_id?: string
  items?: JSONParserOrderItem[]
  created_at?: string
  updated_at?: string
}

export const jsonParserService = {
  // Get all JSON parser orders for a user
  async getJSONParserOrders(userId: string): Promise<{ data: JSONParserOrder[] | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('json_parser_orders')
        .select(`
          *,
          bulk_order_items(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) {
        return { data: null, error }
      }

      // Transform the data to include items
      const transformedData = data?.map(order => ({
        ...order,
        items: order.bulk_order_items || []
      })) || []

      return { data: transformedData, error: null }
    } catch (error) {
      console.error('Error fetching JSON parser orders:', error)
      return { data: null, error: error as Error }
    }
  },

  // Get a single JSON parser order with items
  async getJSONParserOrder(id: string): Promise<{ data: JSONParserOrder | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('json_parser_orders')
        .select(`
          *,
          bulk_order_items(*)
        `)
        .eq('id', id)
        .single()

      if (error) {
        return { data: null, error }
      }

      // Transform the data to include items
      const transformedData = {
        ...data,
        items: data.bulk_order_items || []
      }

      return { data: transformedData, error: null }
    } catch (error) {
      console.error('Error fetching JSON parser order:', error)
      return { data: null, error: error as Error }
    }
  },

  // Create a new JSON parser order with items
  async createJSONParserOrder(jsonParserOrder: Omit<JSONParserOrder, 'id' | 'created_at' | 'updated_at'>, items: Omit<JSONParserOrderItem, 'id' | 'bulk_order_id' | 'created_at' | 'updated_at'>[]): Promise<{ data: JSONParserOrder | null; error: Error | null }> {
    try {
      // Start a transaction by creating the JSON parser order first
      const { data: orderData, error: orderError } = await supabase
        .from('json_parser_orders')
        .insert([jsonParserOrder])
        .select()
        .single()

      if (orderError) {
        return { data: null, error: orderError }
      }

      // Create the items with the JSON parser order ID
      const itemsWithOrderId = items.map(item => ({
        ...item,
        bulk_order_id: orderData.id
      }))

      const { data: itemsData, error: itemsError } = await supabase
        .from('bulk_order_items')
        .insert(itemsWithOrderId)
        .select()

      if (itemsError) {
        // If items creation fails, we should ideally rollback the order creation
        // For now, we'll return the error
        return { data: null, error: itemsError }
      }

      return {
        data: {
          ...orderData,
          items: itemsData
        },
        error: null
      }
    } catch (error) {
      console.error('Error creating JSON parser order:', error)
      return { data: null, error: error as Error }
    }
  },

  // Update JSON parser order status
  async updateJSONParserOrderStatus(id: string, status: JSONParserOrder['status']): Promise<{ data: JSONParserOrder | null; error: Error | null }> {
    try {
      const { data, error } = await supabase
        .from('json_parser_orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return { data: null, error }
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error updating JSON parser order status:', error)
      return { data: null, error: error as Error }
    }
  },

  // Delete a JSON parser order (and its items via CASCADE)
  async deleteJSONParserOrder(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('json_parser_orders')
        .delete()
        .eq('id', id)

      return { error }
    } catch (error) {
      console.error('Error deleting JSON parser order:', error)
      return { error: error as Error }
    }
  },

  // Convert JSON parser order to transactions
  async convertToTransactions(jsonParserOrderId: string): Promise<{ error: Error | null }> {
    try {
      // Get the JSON parser order with items
      const { data: jsonParserOrder, error: fetchError } = await this.getJSONParserOrder(jsonParserOrderId)
      
      if (fetchError || !jsonParserOrder) {
        return { error: fetchError || new Error('JSON parser order not found') }
      }

      // Create transactions for each item
      const transactions = jsonParserOrder.items?.map((item: JSONParserOrderItem) => ({
        user_id: jsonParserOrder.user_id,
        amount: item.total_price,
        description: `${item.item_name} (Qty: ${item.quantity})`,
        category: item.category,
        subcategory: item.subcategory,
        type: 'expense' as const,
        date: new Date().toISOString().split('T')[0],
        source_of_funds_id: jsonParserOrder.source_of_funds_id,
        status: 'paid' as const,
        note: `From JSON parser order: ${jsonParserOrder.title}${item.notes ? ` - ${item.notes}` : ''}`
      })) || []

      if (transactions.length === 0) {
        return { error: new Error('No items to convert') }
      }

      // Insert transactions
      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactions)

      if (insertError) {
        return { error: insertError }
      }

      // Update JSON parser order status to completed
      await this.updateJSONParserOrderStatus(jsonParserOrderId, 'completed')

      // Update parsing record status to converted if it exists
      await this.updateParsingRecordStatus(jsonParserOrderId, 'converted')

      return { error: null }
    } catch (error) {
      console.error('Error converting JSON parser order to transactions:', error)
      return { error: error as Error }
    }
  },

  // Save parsing record to history
  async saveParsingRecord(record: ParsedJSONRecord): Promise<{ error: Error | null }> {
    try {
      const recordToSave = {
        user_id: record.user_id,
        record_id: record.record_id,
        timestamp: record.timestamp,
        json_input: record.json_input,
        extracted_data: record.extracted_data,
        status: record.status,
        error_message: record.error_message
      }

      const { error } = await supabase
        .from('json_parser_history')
        .insert([recordToSave])

      return { error }
    } catch (error) {
      console.error('Error saving JSON parsing record:', error)
      return { error: error as Error }
    }
  },

  // Get JSON parsing history for a user
  async getParsingHistory(userId: string): Promise<ParsedJSONRecord[]> {
    try {
      const { data, error } = await supabase
        .from('json_parser_history')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })

      if (error) {
        console.error('Error fetching JSON parsing history:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching JSON parsing history:', error)
      return []
    }
  },

  // Delete a JSON parsing record
  async deleteParsingRecord(recordId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('json_parser_history')
        .delete()
        .eq('id', recordId)

      return { error }
    } catch (error) {
      console.error('Error deleting JSON parsing record:', error)
      return { error: error as Error }
    }
  },

  // Clear all JSON parsing history for current user
  async clearParsingHistory(): Promise<{ error: Error | null }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return { error: new Error('User not authenticated') }
      }

      const { error } = await supabase
        .from('json_parser_history')
        .delete()
        .eq('user_id', user.id)

      return { error }
    } catch (error) {
      console.error('Error clearing JSON parsing history:', error)
      return { error: error as Error }
    }
  },

  // Update JSON parsing record status
  async updateParsingRecordStatus(recordId: string, status: ParsedJSONRecord['status']): Promise<{ error: Error | null }> {
    try {
      const { error } = await supabase
        .from('json_parser_history')
        .update({ status })
        .eq('record_id', recordId)

      return { error }
    } catch (error) {
      console.error('Error updating JSON parsing record status:', error)
      return { error: error as Error }
    }
  }
}