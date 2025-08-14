'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { migrateLocalDataToSupabase, getLocalStorageTransactions } from '../lib/data-migration'
import { DatabaseIcon, UploadIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react'

interface MigrationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onMigrationComplete: () => void
}

export function MigrationDialog({ open, onOpenChange, onMigrationComplete }: MigrationDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [migrationResult, setMigrationResult] = useState<{
    success: boolean
    migratedCount: number
    errors: string[]
  } | null>(null)

  const localTransactions = getLocalStorageTransactions()
  const hasLocalData = localTransactions.length > 0

  const handleMigrate = async () => {
    setIsLoading(true)
    try {
      const result = await migrateLocalDataToSupabase()
      setMigrationResult(result)
      
      if (result.success) {
        setTimeout(() => {
          onMigrationComplete()
          onOpenChange(false)
        }, 2000)
      }
    } catch (error) {
      setMigrationResult({
        success: false,
        migratedCount: 0,
        errors: ['An unexpected error occurred during migration']
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = () => {
    onMigrationComplete()
    onOpenChange(false)
  }

  if (!hasLocalData) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DatabaseIcon className="h-5 w-5" />
            Data Migration
          </DialogTitle>
          <DialogDescription>
            We found {localTransactions.length} transaction{localTransactions.length !== 1 ? 's' : ''} stored locally on your device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!migrationResult && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Local Data Found</CardTitle>
                  <CardDescription className="text-xs">
                    Your expense data from previous sessions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Transactions:</span>
                    <Badge variant="secondary">{localTransactions.length}</Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="text-sm text-muted-foreground">
                Would you like to migrate this data to your account? This will sync your transactions across all your devices.
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={handleMigrate} 
                  disabled={isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <UploadIcon className="mr-2 h-4 w-4 animate-spin" />
                      Migrating...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="mr-2 h-4 w-4" />
                      Migrate Data
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleSkip} disabled={isLoading}>
                  Skip
                </Button>
              </div>
            </>
          )}

          {migrationResult && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {migrationResult.success ? (
                    <>
                      <CheckCircleIcon className="h-4 w-4 text-green-500" />
                      Migration Successful
                    </>
                  ) : (
                    <>
                      <XCircleIcon className="h-4 w-4 text-red-500" />
                      Migration Completed with Errors
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Migrated:</span>
                  <Badge variant={migrationResult.success ? "default" : "secondary"}>
                    {migrationResult.migratedCount} transactions
                  </Badge>
                </div>
                
                {migrationResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-red-600">Errors:</div>
                    <div className="text-xs text-red-500 space-y-1">
                      {migrationResult.errors.slice(0, 3).map((error, index) => (
                        <div key={index}>{error}</div>
                      ))}
                      {migrationResult.errors.length > 3 && (
                        <div>... and {migrationResult.errors.length - 3} more</div>
                      )}
                    </div>
                  </div>
                )}

                {migrationResult.success && (
                  <div className="text-xs text-green-600 mt-2">
                    Your local data has been successfully migrated and cleared.
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}