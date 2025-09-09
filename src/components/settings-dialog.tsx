'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Separator } from './ui/separator'
import { toast } from 'sonner'
import { Calendar, Settings, Info } from 'lucide-react'
import { dateRangeService, type UserPreferences } from '../services/date-range-service'
import { useAuth } from '../contexts/auth-context'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [customPeriodEnabled, setCustomPeriodEnabled] = useState(false)
  const [startDay, setStartDay] = useState(1)
  const [endDay, setEndDay] = useState(31)
  const [periodDescription, setPeriodDescription] = useState('')

  // Load user preferences when dialog opens
  useEffect(() => {
    if (open && user) {
      loadPreferences()
    }
  }, [open, user])

  // Update period description when settings change
  useEffect(() => {
    updatePeriodDescription()
  }, [customPeriodEnabled, startDay, endDay])

  const loadPreferences = async () => {
    try {
      setLoading(true)
      const userPrefs = await dateRangeService.getUserPreferences()
      if (userPrefs) {
        setPreferences(userPrefs)
        setCustomPeriodEnabled(userPrefs.custom_period_enabled)
        setStartDay(userPrefs.custom_period_start_day)
        setEndDay(userPrefs.custom_period_end_day)
      }
    } catch (error) {
      console.error('Error loading preferences:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const updatePeriodDescription = () => {
    if (!customPeriodEnabled) {
      setPeriodDescription('Standard monthly periods (1st to last day of each month)')
      return
    }

    const now = new Date()
    const currentMonth = now.toLocaleDateString('en-US', { month: 'long' })
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('en-US', { month: 'long' })
    
    if (startDay <= endDay) {
      setPeriodDescription(`${startDay}${getOrdinalSuffix(startDay)} to ${endDay}${getOrdinalSuffix(endDay)} of each month`)
    } else {
      setPeriodDescription(`${startDay}${getOrdinalSuffix(startDay)} of ${currentMonth} to ${endDay}${getOrdinalSuffix(endDay)} of ${nextMonth}`)
    }
  }

  const getOrdinalSuffix = (num: number): string => {
    const j = num % 10
    const k = num % 100
    if (j === 1 && k !== 11) return 'st'
    if (j === 2 && k !== 12) return 'nd'
    if (j === 3 && k !== 13) return 'rd'
    return 'th'
  }

  const validateDays = (): boolean => {
    if (startDay < 1 || startDay > 31) {
      toast.error('Start day must be between 1 and 31')
      return false
    }
    if (endDay < 1 || endDay > 31) {
      toast.error('End day must be between 1 and 31')
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!validateDays()) return

    try {
      setLoading(true)
      
      const updatedPreferences = {
        custom_period_enabled: customPeriodEnabled,
        custom_period_start_day: startDay,
        custom_period_end_day: endDay
      }

      const result = await dateRangeService.updateUserPreferences(updatedPreferences)
      
      if (result) {
        setPreferences(result)
        toast.success('Settings saved successfully')
        onOpenChange(false)
        
        // Clear the date range service cache to force reload of preferences
        dateRangeService.clearCache()
        
        // Trigger a page refresh to update all calculations
        window.location.reload()
      } else {
        toast.error('Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving preferences:', error)
      toast.error('Failed to save settings')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    if (preferences) {
      setCustomPeriodEnabled(preferences.custom_period_enabled)
      setStartDay(preferences.custom_period_start_day)
      setEndDay(preferences.custom_period_end_day)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure your financial period and other preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Custom Date Range Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5" />
                Financial Period
              </CardTitle>
              <CardDescription>
                Set a custom date range for your financial calculations. This affects your homepage totals and category budgets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Custom Period</Label>
                  <div className="text-sm text-muted-foreground">
                    Use a custom date range instead of standard monthly periods
                  </div>
                </div>
                <Switch
                  checked={customPeriodEnabled}
                  onCheckedChange={setCustomPeriodEnabled}
                  disabled={loading}
                />
              </div>

              {customPeriodEnabled && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start-day">Start Day</Label>
                      <Input
                        id="start-day"
                        type="number"
                        min="1"
                        max="31"
                        value={startDay}
                        onChange={(e) => setStartDay(parseInt(e.target.value) || 1)}
                        disabled={loading}
                        placeholder="Day of month"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-day">End Day</Label>
                      <Input
                        id="end-day"
                        type="number"
                        min="1"
                        max="31"
                        value={endDay}
                        onChange={(e) => setEndDay(parseInt(e.target.value) || 31)}
                        disabled={loading}
                        placeholder="Day of month"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800">
                        <div className="font-medium mb-1">Period Preview:</div>
                        <div>{periodDescription}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-800">
                        <div className="font-medium mb-1">Example:</div>
                        <div>Setting start day to 3 and end day to 2 means your financial period runs from the 3rd of each month to the 2nd of the following month.</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Future Settings Sections */}
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-lg">Additional Settings</CardTitle>
              <CardDescription>
                More customization options coming soon...
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                • Currency preferences
                • Date format options
                • Notification settings
                • Export preferences
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={loading}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}