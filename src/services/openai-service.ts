interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

import { supabase } from '../lib/supabase'
import type { ParsedImageRecord } from '../lib/supabase'

class OpenAIService {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1';
  private history: ParsedImageRecord[] = [];
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 second between requests

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('OpenAI API key not found. Please set NEXT_PUBLIC_OPENAI_API_KEY environment variable.');
    }
  }

  private async rateLimitDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  async extractTransactionsFromImage(imageFile: File): Promise<{
    success: boolean;
    data?: any;
    record: ParsedImageRecord;
  }> {
    const recordId = `parse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Convert image to base64
      const imageData = await this.fileToBase64(imageFile);
      const base64Image = imageData.split(',')[1]; // Remove data:image/...;base64, prefix
      
      // Rate limiting
      await this.rateLimitDelay();
      this.lastRequestTime = Date.now();
      
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Please analyze this image and extract any financial transactions you can find. Return the data in the following JSON format:

{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "Transaction description",
      "amount": number,
      "type": "income" or "expense",
      "category": "Category name"
    }
  ],
  "summary": {
    "total_transactions": number,
    "total_income": number,
    "total_expenses": number,
    "date_range": "Date range if applicable"
  }
}

If no transactions are found, return an empty transactions array. Be as accurate as possible with amounts and dates.`
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${this.getImageType(imageFile)};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const openaiResponse: OpenAIResponse = await response.json();
      const content = openaiResponse.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      // Try to parse the JSON response
      let extractedData;
      try {
        // Remove any markdown code block formatting
        const cleanContent = content.replace(/```json\n?|```\n?/g, '').trim();
        extractedData = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response as JSON:', parseError);
        extractedData = { error: 'Failed to parse response', raw_content: content };
      }

      // Create success record
      const record: ParsedImageRecord = {
        id: '', // Will be set by database
        user_id: '', // Will be set when saving to database
        record_id: recordId,
        timestamp: new Date().toISOString(),
        image_data: imageData,
        openai_response: openaiResponse,
        extracted_json: extractedData,
        status: 'success' as const
      };

      // Save to database
      await this.saveToDatabase(record);

      return {
        success: true,
        data: extractedData,
        record
      };

    } catch (error) {
      console.error('Error extracting transactions:', error);
      
      // Create error record
      const errorRecord: ParsedImageRecord = {
        id: '', // Will be set by database
        user_id: '', // Will be set when saving to database
        record_id: recordId,
        timestamp: new Date().toISOString(),
        image_data: await this.fileToBase64(imageFile),
        openai_response: null,
        extracted_json: null,
        status: 'error' as const,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };

      // Save error to database
      await this.saveToDatabase(errorRecord);

      return {
        success: false,
        record: errorRecord
      };
    }
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  private getImageType(file: File): string {
    return file.type || 'image/jpeg';
  }

  private async saveToDatabase(record: ParsedImageRecord) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('No authenticated user found, cannot save to database');
        return;
      }

      const recordToSave = {
        ...record,
        user_id: user.id
      };

      const { error } = await supabase
        .from('parsing_history')
        .insert([recordToSave]);

      if (error) {
        console.error('Error saving to database:', error);
        throw error;
      }

      console.log('Successfully saved parsing record to database');
    } catch (error) {
      console.error('Failed to save to database:', error);
      throw error;
    }
  }

  async getHistory(): Promise<ParsedImageRecord[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('No authenticated user found');
        return [];
      }

      const { data, error } = await supabase
        .from('parsing_history')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error fetching history:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch history:', error);
      return [];
    }
  }

  async clearHistory() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('No authenticated user found');
        return;
      }

      const { error } = await supabase
        .from('parsing_history')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Error clearing history:', error);
        throw error;
      }

      console.log('Successfully cleared parsing history');
    } catch (error) {
      console.error('Failed to clear history:', error);
      throw error;
    }
  }

  async deleteHistoryItem(id: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.warn('No authenticated user found');
        return;
      }

      const { error } = await supabase
        .from('parsing_history')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error deleting history item:', error);
        throw error;
      }

      console.log('Successfully deleted parsing history item');
    } catch (error) {
      console.error('Failed to delete history item:', error);
      throw error;
    }
  }
}

export const openaiService = new OpenAIService();
export type { ParsedImageRecord, OpenAIResponse };