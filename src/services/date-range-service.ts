import { supabase } from '../lib/supabase'

export interface UserPreferences {
  id: string
  user_id: string
  custom_period_enabled: boolean
  custom_period_start_day: number
  custom_period_end_day: number
  currency_preference: string
  date_format: string
  created_at?: string
  updated_at?: string
}

export interface DateRange {
  startDate: string // ISO date string (YYYY-MM-DD)
  endDate: string   // ISO date string (YYYY-MM-DD)
}

export class DateRangeService {
  private static instance: DateRangeService
  private userPreferences: UserPreferences | null = null
  private preferencesLoaded = false
  private currentPeriodRange: DateRange | null = null
  private currentPeriodDescription: string | null = null
  private cacheTimestamp: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  static getInstance(): DateRangeService {
    if (!DateRangeService.instance) {
      DateRangeService.instance = new DateRangeService()
    }
    return DateRangeService.instance
  }

  /**
   * Get user preferences from database
   */
  async getUserPreferences(): Promise<UserPreferences | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No preferences found, create default ones
          return await this.createDefaultPreferences(user.id)
        }
        console.error('Error fetching user preferences:', error)
        return null
      }

      this.userPreferences = data
      this.preferencesLoaded = true
      return data
    } catch (error) {
      console.error('Exception in getUserPreferences:', error)
      return null
    }
  }

  /**
   * Create default preferences for a user
   */
  private async createDefaultPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const defaultPreferences = {
        user_id: userId,
        custom_period_enabled: false,
        custom_period_start_day: 1,
        custom_period_end_day: 31,
        currency_preference: 'IDR',
        date_format: 'DD/MM/YYYY'
      }

      const { data, error } = await supabase
        .from('user_preferences')
        .insert(defaultPreferences)
        .select()
        .single()

      if (error) {
        console.error('Error creating default preferences:', error)
        return null
      }

      this.userPreferences = data
      this.preferencesLoaded = true
      return data
    } catch (error) {
      console.error('Exception in createDefaultPreferences:', error)
      return null
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<UserPreferences | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('user_preferences')
        .update(preferences)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) {
        console.error('Error updating user preferences:', error)
        return null
      }

      this.userPreferences = data
      return data
    } catch (error) {
      console.error('Exception in updateUserPreferences:', error)
      return null
    }
  }

  /**
   * Get the current period date range based on user preferences (cached)
   */
  async getCurrentPeriodRange(): Promise<DateRange> {
    const now = Date.now()
    
    // Return cached result if still valid
    if (this.currentPeriodRange && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      console.log('[DATE RANGE DEBUG] Using cached period range:', this.currentPeriodRange)
      return this.currentPeriodRange
    }
    
    const preferences = await this.getUserPreferences()
    
    let range: DateRange
    if (!preferences || !preferences.custom_period_enabled) {
      // Use default monthly period (1st to last day of current month)
      range = this.getCurrentMonthRange()
    } else {
      // Use custom period
      range = this.getCustomPeriodRange(
        preferences.custom_period_start_day,
        preferences.custom_period_end_day
      )
    }
    
    // Cache the result
    this.currentPeriodRange = range
    this.cacheTimestamp = now
    
    return range
  }

  /**
   * Get current month range (1st to last day of current month)
   */
  private getCurrentMonthRange(): DateRange {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    
    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0) // Last day of current month
    
    return {
      startDate: this.formatDateToISO(startDate),
      endDate: this.formatDateToISO(endDate)
    }
  }

  /**
   * Get custom period range based on start and end days
   * Handles periods that span across months (e.g., 3rd of this month to 2nd of next month)
   */
  private getCustomPeriodRange(startDay: number, endDay: number): DateRange {
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    const currentDay = now.getDate()
    

    
    let periodStartDate: Date
    let periodEndDate: Date
    
    if (startDay <= endDay) {
      // Period within the same month (e.g., 1st to 15th)

      if (currentDay >= startDay) {
        // We're in the current period
        periodStartDate = new Date(currentYear, currentMonth, startDay)
        periodEndDate = new Date(currentYear, currentMonth, endDay)

      } else {
        // We're before the current period, use previous month's period
        periodStartDate = new Date(currentYear, currentMonth - 1, startDay)
        periodEndDate = new Date(currentYear, currentMonth - 1, endDay)

      }
    } else {
      // Period spans across months (e.g., 3rd of this month to 2nd of next month)

      if (currentDay >= startDay) {
        // We're in the current period (started this month, ends next month)
        periodStartDate = new Date(currentYear, currentMonth, startDay)
        periodEndDate = new Date(currentYear, currentMonth + 1, endDay)

      } else if (currentDay <= endDay) {
        // We're in the period that started last month and ends this month
        periodStartDate = new Date(currentYear, currentMonth - 1, startDay)
        periodEndDate = new Date(currentYear, currentMonth, endDay)

      } else {
        // We're between periods (after end day but before start day)
        // Use the next period (starts this month, ends next month)
        periodStartDate = new Date(currentYear, currentMonth, startDay)
        periodEndDate = new Date(currentYear, currentMonth + 1, endDay)

      }
    }
    
    const result = {
      startDate: this.formatDateToISO(periodStartDate),
      endDate: this.formatDateToISO(periodEndDate)
    }
    

    
    return result
  }

  /**
   * Get date range for a specific number of periods ago
   * @param periodsAgo Number of periods to go back (0 = current, 1 = previous, etc.)
   */
  async getPeriodRange(periodsAgo: number = 0): Promise<DateRange> {
    const preferences = await this.getUserPreferences()
    
    if (!preferences || !preferences.custom_period_enabled) {
      // Default to monthly periods
      const now = new Date()
      const targetMonth = now.getMonth() - periodsAgo
      const targetYear = now.getFullYear() + Math.floor(targetMonth / 12)
      const adjustedMonth = ((targetMonth % 12) + 12) % 12
      
      const startDate = new Date(targetYear, adjustedMonth, 1)
      const endDate = new Date(targetYear, adjustedMonth + 1, 0)
      
      return {
        startDate: this.formatDateToISO(startDate),
        endDate: this.formatDateToISO(endDate)
      }
    }

    // Calculate custom period range for periods ago
    const currentRange = this.getCustomPeriodRange(
      preferences.custom_period_start_day,
      preferences.custom_period_end_day
    )
    
    const currentStart = new Date(currentRange.startDate)
    const currentEnd = new Date(currentRange.endDate)
    
    // Calculate the period length to go back
    const periodLength = currentEnd.getTime() - currentStart.getTime()
    const millisecondsToSubtract = periodLength * periodsAgo
    
    const targetStart = new Date(currentStart.getTime() - millisecondsToSubtract)
    const targetEnd = new Date(currentEnd.getTime() - millisecondsToSubtract)
    
    return {
      startDate: this.formatDateToISO(targetStart),
      endDate: this.formatDateToISO(targetEnd)
    }
  }

  /**
   * Check if a given date is within the current period (optimized with caching)
   */
  async isDateInCurrentPeriod(date: string): Promise<boolean> {
    const currentRange = await this.getCurrentPeriodRange() // This now uses caching
    const checkDate = new Date(date)
    const startDate = new Date(currentRange.startDate)
    const endDate = new Date(currentRange.endDate)
    
    // Set time to start of day for accurate comparison
    checkDate.setHours(0, 0, 0, 0)
    startDate.setHours(0, 0, 0, 0)
    endDate.setHours(23, 59, 59, 999)
    
    return checkDate >= startDate && checkDate <= endDate
  }

  /**
   * Format a Date object to ISO date string (YYYY-MM-DD)
   */
  private formatDateToISO(date: Date): string {
    // Use local timezone to avoid UTC conversion issues
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  /**
   * Get a human-readable description of the current period (cached)
   */
  async getCurrentPeriodDescription(): Promise<string> {
    const now = Date.now()
    
    // Check if we have a cached description that's still valid
    if (this.currentPeriodDescription && 
        this.cacheTimestamp && 
        (now - this.cacheTimestamp) < this.CACHE_DURATION) {
      return this.currentPeriodDescription
    }

    const currentPeriod = await this.getCurrentPeriodRange()
    const startDate = new Date(currentPeriod.startDate)
    const endDate = new Date(currentPeriod.endDate)
    
    const startDay = startDate.getDate()
    const endDay = endDate.getDate()
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' })
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' })
    const year = endDate.getFullYear()
    
    this.currentPeriodDescription = `${startDay}${this.getOrdinalSuffix(startDay)} ${startMonth} - ${endDay}${this.getOrdinalSuffix(endDay)} ${endMonth} ${year}`
    this.cacheTimestamp = now
    
    return this.currentPeriodDescription
  }

  /**
   * Get ordinal suffix for a number (1st, 2nd, 3rd, etc.)
   */
  private getOrdinalSuffix(num: number): string {
    const j = num % 10
    const k = num % 100
    if (j === 1 && k !== 11) return 'st'
    if (j === 2 && k !== 12) return 'nd'
    if (j === 3 && k !== 13) return 'rd'
    return 'th'
  }

  /**
   * Clear cached preferences and period calculations (useful when user updates settings)
   */
  clearCache(): void {
    this.currentPeriodRange = null
    this.currentPeriodDescription = null
    this.cacheTimestamp = 0
    this.userPreferences = null
    this.preferencesLoaded = false
  }

  /**
   * Generate available periods based on user preferences and oldest transaction date
   * @param oldestTransactionDate The oldest transaction date in the system
   * @returns Array of period options with start and end dates
   */
  async generateAvailablePeriods(oldestTransactionDate: string | null): Promise<Array<{ label: string; startDate: string; endDate: string }>> {
    const preferences = await this.getUserPreferences()
    
    if (!preferences || !oldestTransactionDate) {
      return []
    }

    const periods: Array<{ label: string; startDate: string; endDate: string }> = []
    const oldestDate = new Date(oldestTransactionDate)
    const today = new Date()
    
    if (preferences.custom_period_enabled) {
      // Use custom period settings
      const startDay = preferences.custom_period_start_day
      const endDay = preferences.custom_period_end_day
      
      // Calculate the first period that includes the oldest transaction
      let currentPeriodStart = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), startDay)
      
      // If the oldest transaction is before the start day of that month, go to previous period
      if (oldestDate.getDate() < startDay && startDay <= endDay) {
        currentPeriodStart = new Date(oldestDate.getFullYear(), oldestDate.getMonth() - 1, startDay)
      } else if (oldestDate.getDate() < startDay && startDay > endDay) {
        // Period spans across months and oldest date is before start day
        currentPeriodStart = new Date(oldestDate.getFullYear(), oldestDate.getMonth() - 1, startDay)
      }
      
      // Generate periods from oldest to current
      while (currentPeriodStart <= today) {
        let periodEnd: Date
        
        if (startDay <= endDay) {
          // Period within same month
          periodEnd = new Date(currentPeriodStart.getFullYear(), currentPeriodStart.getMonth(), endDay)
        } else {
          // Period spans across months
          periodEnd = new Date(currentPeriodStart.getFullYear(), currentPeriodStart.getMonth() + 1, endDay)
        }
        
        const startDateStr = this.formatDateToISO(currentPeriodStart)
        const endDateStr = this.formatDateToISO(periodEnd)
        
        // Create readable label
        const startMonth = currentPeriodStart.toLocaleDateString('en-US', { month: 'short' })
        const endMonth = periodEnd.toLocaleDateString('en-US', { month: 'short' })
        const startYear = currentPeriodStart.getFullYear()
        const endYear = periodEnd.getFullYear()
        
        let label: string
        if (startMonth === endMonth && startYear === endYear) {
          label = `${startDay}${this.getOrdinalSuffix(startDay)} - ${endDay}${this.getOrdinalSuffix(endDay)} ${startMonth} ${startYear}`
        } else if (startYear === endYear) {
          label = `${startDay}${this.getOrdinalSuffix(startDay)} ${startMonth} - ${endDay}${this.getOrdinalSuffix(endDay)} ${endMonth} ${startYear}`
        } else {
          label = `${startDay}${this.getOrdinalSuffix(startDay)} ${startMonth} ${startYear} - ${endDay}${this.getOrdinalSuffix(endDay)} ${endMonth} ${endYear}`
        }
        
        periods.push({
          label,
          startDate: startDateStr,
          endDate: endDateStr
        })
        
        // Move to next period
        if (startDay <= endDay) {
          currentPeriodStart = new Date(currentPeriodStart.getFullYear(), currentPeriodStart.getMonth() + 1, startDay)
        } else {
          currentPeriodStart = new Date(currentPeriodStart.getFullYear(), currentPeriodStart.getMonth() + 1, startDay)
        }
      }
    } else {
      // Use default monthly periods
      let currentDate = new Date(oldestDate.getFullYear(), oldestDate.getMonth(), 1)
      
      while (currentDate <= today) {
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        
        const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        
        periods.push({
          label: monthYear,
          startDate: this.formatDateToISO(startDate),
          endDate: this.formatDateToISO(endDate)
        })
        
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
      }
    }
    
    // Return periods in reverse order (most recent first)
    return periods.reverse()
  }
}

// Export singleton instance
export const dateRangeService = DateRangeService.getInstance()