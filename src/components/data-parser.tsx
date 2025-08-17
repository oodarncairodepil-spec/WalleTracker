'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { toast } from 'sonner'
import { Upload, FileImage, Trash2, Eye, Download, RefreshCw } from 'lucide-react'
import { openaiService, type ParsedImageRecord } from '../services/openai-service'
import { useAuth } from '../contexts/auth-context'
import { formatIDR } from '../lib/utils'

interface Transaction {
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  category: string
}

interface ExtractedData {
  transactions: Transaction[]
  summary: {
    total_transactions: number
    total_income: number
    total_expenses: number
    date_range?: string
  }
}

interface DataParserProps {
  isOpen: boolean
  onClose: () => void
  onTransactionsExtracted?: (transactions: Transaction[]) => void
}

export function DataParser({ isOpen, onClose, onTransactionsExtracted }: DataParserProps) {
  const { user } = useAuth()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [parsingHistory, setParsingHistory] = useState<ParsedImageRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<ParsedImageRecord | null>(null)
  const [showRecordDetails, setShowRecordDetails] = useState(false)

  // Load parsing history when dialog opens
  useEffect(() => {
    if (isOpen && user) {
      loadParsingHistory()
    }
  }, [isOpen, user])

  const loadParsingHistory = async () => {
    try {
      const history = await openaiService.getHistory()
      setParsingHistory(history)
    } catch (error) {
      console.error('Failed to load parsing history:', error)
      setParsingHistory([])
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type.startsWith('image/')) {
        setSelectedFile(file)
        setExtractedData(null)
      } else {
        toast.error('Please select an image file')
      }
    }
  }

  const processImage = async () => {
    if (!selectedFile) {
      toast.error('Please select an image first')
      return
    }

    if (!user) {
      toast.error('Please sign in to use the AI data parser')
      return
    }

    setIsProcessing(true)
    
    try {
      const result = await openaiService.extractTransactionsFromImage(selectedFile)
      
      if (result.success && result.data) {
        setExtractedData(result.data)
        toast.success(`Successfully extracted ${result.data.transactions?.length || 0} transactions`)
        
        // Refresh history
        await loadParsingHistory()
      } else {
        toast.error('Failed to extract transactions from image')
      }
    } catch (error) {
      console.error('Error processing image:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        toast.error('OpenAI rate limit exceeded. Please wait a moment before trying again.')
      } else if (errorMessage.includes('API key')) {
        toast.error('OpenAI API key is not configured. Please check your environment variables.')
      } else {
        toast.error(`Failed to process image: ${errorMessage}`)
      }
    } finally {
      setIsProcessing(false)
    }
  }

  const handleUseTransactions = () => {
    if (extractedData?.transactions && onTransactionsExtracted) {
      onTransactionsExtracted(extractedData.transactions)
      toast.success('Transactions added to your expense tracker')
      onClose()
    }
  }

  const deleteHistoryItem = async (id: string) => {
    try {
      await openaiService.deleteHistoryItem(id)
      toast.success('History item deleted')
      await loadParsingHistory()
    } catch (error) {
      console.error('Failed to delete history item:', error)
      toast.error('Failed to delete history item')
    }
  }

  const clearHistory = async () => {
    try {
      await openaiService.clearHistory()
      toast.success('History cleared')
      await loadParsingHistory()
    } catch (error) {
      console.error('Failed to clear history:', error)
      toast.error('Failed to clear history')
    }
  }

  const viewHistoryDetails = (record: ParsedImageRecord) => {
    setSelectedRecord(record)
    setShowRecordDetails(true)
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              AI Data Parser
            </DialogTitle>
            <DialogDescription>
              Upload an image containing financial data and let AI extract transactions for you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* File Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload Image</CardTitle>
                <CardDescription>
                  Select an image containing receipts, bank statements, or other financial data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="image-upload">Choose Image File</Label>
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                  />
                </div>
                
                {selectedFile && (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                    <FileImage className="h-4 w-4" />
                    <span className="text-sm">{selectedFile.name}</span>
                    <Badge variant="secondary">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</Badge>
                  </div>
                )}

                <Button 
                  onClick={processImage} 
                  disabled={!selectedFile || isProcessing}
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Extract Transactions
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Results Section */}
            {extractedData && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Extracted Data</CardTitle>
                  <CardDescription>
                    Review the extracted transactions before adding them to your tracker
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted rounded-md">
                      <div className="text-2xl font-bold">{extractedData.summary.total_transactions}</div>
                      <div className="text-sm text-muted-foreground">Transactions</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-md">
                      <div className="text-2xl font-bold text-green-600">
                        {formatIDR(extractedData.summary.total_income)}
                      </div>
                      <div className="text-sm text-muted-foreground">Income</div>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-md">
                      <div className="text-2xl font-bold text-red-600">
                        {formatIDR(extractedData.summary.total_expenses)}
                      </div>
                      <div className="text-sm text-muted-foreground">Expenses</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-md">
                      <div className="text-2xl font-bold text-blue-600">
                        {formatIDR(extractedData.summary.total_income - extractedData.summary.total_expenses)}
                      </div>
                      <div className="text-sm text-muted-foreground">Net</div>
                    </div>
                  </div>

                  {/* Transactions List */}
                  <div className="space-y-2">
                    <h4 className="font-medium">Transactions ({extractedData.transactions.length})</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {extractedData.transactions.map((transaction, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-md">
                          <div className="flex-1">
                            <div className="font-medium">{transaction.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {transaction.date} • {transaction.category}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-medium ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}{formatIDR(Math.abs(transaction.amount))}
                            </div>
                            <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'}>
                              {transaction.type}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button onClick={handleUseTransactions} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    Add These Transactions
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* History Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Parsing History</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadParsingHistory}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    {parsingHistory.length > 0 && (
                      <Button variant="outline" size="sm" onClick={clearHistory}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {parsingHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No parsing history yet. Upload an image to get started.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {parsingHistory.map((record) => (
                      <div key={record.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={record.status === 'success' ? 'default' : 'destructive'}>
                              {record.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {formatTimestamp(record.timestamp)}
                            </span>
                          </div>
                          {record.status === 'error' && record.error_message && (
                            <div className="text-sm text-red-600 mt-1">
                              {record.error_message}
                            </div>
                          )}
                          {record.status === 'success' && record.extracted_json?.summary && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {record.extracted_json.summary.total_transactions} transactions extracted
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => viewHistoryDetails(record)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => deleteHistoryItem(record.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Details Dialog */}
      <Dialog open={showRecordDetails} onOpenChange={setShowRecordDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parsing Record Details</DialogTitle>
          </DialogHeader>
          
          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Badge variant={selectedRecord.status === 'success' ? 'default' : 'destructive'}>
                    {selectedRecord.status}
                  </Badge>
                </div>
                <div>
                  <Label>Timestamp</Label>
                  <div className="text-sm">{formatTimestamp(selectedRecord.timestamp)}</div>
                </div>
              </div>

              {selectedRecord.error_message && (
                <div>
                  <Label>Error Message</Label>
                  <div className="text-sm text-red-600 p-2 bg-red-50 rounded">
                    {selectedRecord.error_message}
                  </div>
                </div>
              )}

              {selectedRecord.extracted_json && (
                <div>
                  <Label>Extracted Data</Label>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
                    {JSON.stringify(selectedRecord.extracted_json, null, 2)}
                  </pre>
                </div>
              )}

              {selectedRecord.openai_response && (
                <div>
                  <Label>OpenAI Response Details</Label>
                  <div className="text-sm space-y-1">
                    <div>Model: {selectedRecord.openai_response.model}</div>
                    {selectedRecord.openai_response.usage && (
                      <div>Tokens: {selectedRecord.openai_response.usage.total_tokens}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}