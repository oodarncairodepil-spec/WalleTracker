'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { toast } from 'sonner'
import { Upload, FileText, Trash2, Eye, Download, RefreshCw, Wallet, Tag } from 'lucide-react'
import { useAuth } from '../contexts/auth-context'
import { formatIDR } from '../lib/utils'
import { fundsService } from '../services/funds-service'
import { categoriesServiceV2 } from '../services/categories-service-v2'
import { jsonParserService, type ParsedJSONRecord } from '../services/json-parser-service'
import type { ExtractedTransaction, Fund } from '../lib/supabase'
import type { MainCategory, Subcategory } from '../services/categories-service-v2'

interface ExtractedData {
  transactions: ExtractedTransaction[]
  summary: {
    total_transactions: number
    total_income: number
    total_expenses: number
    date_range?: string
  }
}

interface JSONParserProps {
  isOpen: boolean
  onClose: () => void
  onTransactionsExtracted?: (transactions: ExtractedTransaction[]) => void
}

export function JSONParser({ isOpen, onClose, onTransactionsExtracted }: JSONParserProps) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('input')
  const [jsonInput, setJsonInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [parsingHistory, setParsingHistory] = useState<ParsedJSONRecord[]>([])
  const [selectedRecord, setSelectedRecord] = useState<ParsedJSONRecord | null>(null)
  const [showRecordDetails, setShowRecordDetails] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  
  // Fund and category states
  const [funds, setFunds] = useState<Fund[]>([])
  const [selectedFund, setSelectedFund] = useState<string>('')
  const [categories, setCategories] = useState<MainCategory[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [transactionCategories, setTransactionCategories] = useState<{[key: number]: {categoryId: string, subcategoryId: string}}>({})

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getStatusBadgeProps = (status: ParsedJSONRecord['status']) => {
    switch (status) {
      case 'success':
        return { variant: 'secondary' as const, className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' }
      case 'error':
        return { variant: 'destructive' as const, className: 'bg-red-100 text-red-800 hover:bg-red-200' }
      case 'converted':
        return { variant: 'default' as const, className: 'bg-green-100 text-green-800 hover:bg-green-200' }
      default:
        return { variant: 'secondary' as const }
    }
  }

  useEffect(() => {
    if (isOpen && user) {
      loadParsingHistory()
      loadFunds()
      loadCategories()
    }
  }, [isOpen, user])

  const loadFunds = async () => {
    try {
      const fundsData = await fundsService.getFunds()
      setFunds(fundsData)
      // Set default fund if available
      const defaultFund = await fundsService.getDefaultFund()
      if (defaultFund) {
        setSelectedFund(defaultFund.id)
      }
    } catch (error) {
      console.error('Error loading funds:', error)
    }
  }

  const loadCategories = async () => {
    try {
      if (!user?.id) return
      
      const categoriesResponse = await categoriesServiceV2.getMainCategories(user.id)
      if (categoriesResponse.data) {
        setCategories(categoriesResponse.data)
      }
      
      const subcategoriesResponse = await categoriesServiceV2.getAllSubcategories(user.id)
      if (subcategoriesResponse.data) {
        setSubcategories(subcategoriesResponse.data)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const parseJsonInput = (jsonString: string): ExtractedTransaction[] => {
    // Check if input is empty or just whitespace
    if (!jsonString || !jsonString.trim()) {
      throw new Error('Please enter valid JSON data')
    }

    // Check if input looks like a URL or non-JSON text
    const trimmedInput = jsonString.trim()
    if (trimmedInput.startsWith('http') || trimmedInput.startsWith('www') || !trimmedInput.startsWith('{')) {
      throw new Error('Input appears to be a URL or plain text. Please enter valid JSON data with a "transactions" array.')
    }

    try {
      const parsed = JSON.parse(jsonString)
      
      // Validate that parsed result is an object
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('JSON must be an object containing a "transactions" array')
      }
      
      // Check for transactions array
      if (!parsed.transactions) {
        throw new Error('JSON must contain a "transactions" property')
      }
      
      if (!Array.isArray(parsed.transactions)) {
        throw new Error('The "transactions" property must be an array')
      }

      if (parsed.transactions.length === 0) {
        throw new Error('The "transactions" array cannot be empty')
      }

      // Validate each transaction has required fields
      const validatedTransactions = parsed.transactions.map((transaction: any, index: number) => {
        if (typeof transaction !== 'object' || transaction === null) {
          throw new Error(`Transaction at index ${index} must be an object`)
        }

        // Validate amount is a valid number
        const amount = parseFloat(transaction.amount)
        if (isNaN(amount)) {
          throw new Error(`Transaction at index ${index} has invalid amount: "${transaction.amount}"`)
        }

        return {
          id: `temp-${index}`,
          user_id: user?.id || '',
          date: transaction.date || new Date().toISOString().split('T')[0],
          description: transaction.description || `Transaction ${index + 1}`,
          amount: amount,
          currency: transaction.currency || 'IDR',
          category: transaction.category || '',
          subcategory: transaction.subcategory || '',
          fund_id: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })

      return validatedTransactions
    } catch (error) {
      if (error instanceof SyntaxError) {
        // More specific JSON syntax error messages
        const message = error.message.toLowerCase()
        if (message.includes('unexpected token')) {
          throw new Error('Invalid JSON syntax. Please check for missing quotes, commas, or brackets.')
        } else if (message.includes('unexpected end')) {
          throw new Error('Incomplete JSON. Please check that all brackets and braces are properly closed.')
        } else {
          throw new Error(`JSON syntax error: ${error.message}`)
        }
      }
      
      // Re-throw our custom validation errors
      if (error instanceof Error && error.message.includes('Transaction at index')) {
        throw error
      }
      
      throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleParseJSON = async () => {
    if (!jsonInput.trim()) {
      toast.error('Please enter JSON data')
      return
    }

    setIsProcessing(true)
    try {
      const transactions = parseJsonInput(jsonInput)
      
      const income = transactions
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0)
      
      const expenses = Math.abs(transactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0))

      const extractedData = {
        transactions,
        summary: {
          total_transactions: transactions.length,
          total_income: income,
          total_expenses: expenses
        }
      }
      
      setExtractedData(extractedData)
      
      // Initialize transaction categories with empty values
      const initialCategories: {[key: number]: {categoryId: string, subcategoryId: string}} = {}
      transactions.forEach((_, index) => {
        initialCategories[index] = { categoryId: '', subcategoryId: '' }
      })
      setTransactionCategories(initialCategories)

      // Switch to results tab
      setActiveTab('results')
      
      // Create parsing record
      const record: ParsedJSONRecord = {
        id: Date.now().toString(),
        user_id: user?.id || '',
        record_id: crypto.randomUUID(),
        image_data: btoa(jsonInput),
        openai_response: { original_input: jsonInput },
        extracted_json: transactions,
        status: 'success',
        timestamp: new Date().toISOString()
      }

      // Save to history
      await jsonParserService.saveParsingRecord(record)
      await loadParsingHistory()

      // Call the callback if provided
      if (onTransactionsExtracted) {
        onTransactionsExtracted(transactions)
      }

      toast.success(`Successfully extracted ${transactions.length} transactions`)
    } catch (error) {
      console.error('Error parsing JSON:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      // Create error record
      const record: ParsedJSONRecord = {
        id: Date.now().toString(),
        user_id: user?.id || '',
        record_id: crypto.randomUUID(),
        image_data: btoa(jsonInput),
        openai_response: { original_input: jsonInput },
        extracted_json: [],
        status: 'error',
        error_message: errorMessage,
        timestamp: new Date().toISOString()
      }

      // Save error to history
      await jsonParserService.saveParsingRecord(record)
      await loadParsingHistory()
      
      toast.error(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const loadParsingHistory = async () => {
    if (!user?.id) return
    
    setIsLoadingHistory(true)
    try {
      const history = await jsonParserService.getParsingHistory(user.id)
      setParsingHistory(history)
    } catch (error) {
      console.error('Error loading parsing history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const deleteHistoryItem = async (recordId: string) => {
    try {
      await jsonParserService.deleteParsingRecord(recordId)
      setParsingHistory(prev => prev.filter(record => record.id !== recordId))
      toast.success('Record deleted')
    } catch (error) {
      console.error('Error deleting record:', error)
      toast.error('Failed to delete record')
    }
  }

  const clearHistory = async () => {
    try {
      await jsonParserService.clearParsingHistory()
      setParsingHistory([])
      toast.success('Parsing history cleared')
    } catch (error) {
      console.error('Error clearing history:', error)
      toast.error('Failed to clear history')
    }
  }

  const handleCategoryChange = (transactionIndex: number, categoryId: string) => {
    setTransactionCategories(prev => ({
      ...prev,
      [transactionIndex]: {
        ...prev[transactionIndex],
        categoryId,
        subcategoryId: '' // Reset subcategory when main category changes
      }
    }))
  }

  const handleSubcategoryChange = (transactionIndex: number, subcategoryId: string) => {
    setTransactionCategories(prev => ({
      ...prev,
      [transactionIndex]: {
        ...prev[transactionIndex],
        subcategoryId
      }
    }))
  }

  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter(sub => sub.main_category_id === categoryId)
  }

  const viewHistoryDetails = (record: ParsedJSONRecord) => {
    if (record.status === 'success' && record.extracted_json) {
      // Load the parsed data into results tab
      setExtractedData({
        transactions: record.extracted_json,
        summary: {
          total_transactions: record.extracted_json.length,
          total_income: record.extracted_json.filter((t: any) => t.amount > 0).reduce((sum: number, t: any) => sum + t.amount, 0),
          total_expenses: Math.abs(record.extracted_json.filter((t: any) => t.amount < 0).reduce((sum: number, t: any) => sum + t.amount, 0))
        }
      })
      setActiveTab('results')
    } else {
      // Show details dialog for error records
      setSelectedRecord(record)
      setShowRecordDetails(true)
    }
  }

  const downloadJSON = () => {
    if (!extractedData) return
    
    const dataStr = JSON.stringify(extractedData.transactions, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `extracted-transactions-${new Date().toISOString().split('T')[0]}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              JSON Parser
            </DialogTitle>
            <DialogDescription>
              Parse JSON data to extract transaction information
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="input">Input</TabsTrigger>
              <TabsTrigger value="results" disabled={!extractedData}>Results</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            {/* Input Tab */}
            <TabsContent value="input" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    JSON Input
                  </CardTitle>
                  <CardDescription>
                    Paste your JSON data containing transaction information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="json-input">JSON Data</Label>
                    <Textarea
                      id="json-input"
                      placeholder={`{\n  "account_information": {\n    "account_no": "658-048-7198"\n  },\n  "transactions": [\n    {\n      "date": "2025-08-15",\n      "description": "BIAYA ADM",\n      "amount": -17000.0,\n      "currency": "IDR"\n    }\n  ]\n}`}
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                      className="min-h-[300px] font-mono text-sm"
                    />
                  </div>
                  
                  <Button 
                    onClick={handleParseJSON} 
                    disabled={isProcessing || !jsonInput.trim()}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Parsing JSON...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Parse JSON
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results" className="space-y-4">
              {extractedData && (
                <>
                  {/* Fund Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        Fund Selection
                      </CardTitle>
                      <CardDescription>
                        Select the fund source for all transactions
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Select value={selectedFund} onValueChange={setSelectedFund}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a fund" />
                        </SelectTrigger>
                        <SelectContent>
                          {funds.map((fund) => (
                            <SelectItem key={fund.id} value={fund.id}>
                              {fund.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>



                  {/* Transaction List with Category Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tag className="h-5 w-5" />
                          Transaction Categories
                        </div>
                        <Button onClick={downloadJSON} variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Download JSON
                        </Button>
                      </CardTitle>
                      <CardDescription>
                        Assign categories to each transaction
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {extractedData.transactions.map((transaction, index) => (
                          <div key={index} className="p-4 border rounded-lg space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-medium">{transaction.description}</div>
                                <div className="text-sm text-muted-foreground">{transaction.date}</div>
                              </div>
                              <div className={`font-bold ${transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatIDR(transaction.amount)}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Category</Label>
                                <Select 
                                  value={transactionCategories[index]?.categoryId || ''} 
                                  onValueChange={(value) => handleCategoryChange(index, value)}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map((category) => (
                                      <SelectItem key={category.id} value={category.id}>
                                        {category.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              
                              <div>
                                <Label className="text-xs">Subcategory</Label>
                                <Select 
                                  value={transactionCategories[index]?.subcategoryId || ''} 
                                  onValueChange={(value) => handleSubcategoryChange(index, value)}
                                  disabled={!transactionCategories[index]?.categoryId}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Select subcategory" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {getSubcategoriesForCategory(transactionCategories[index]?.categoryId || '').map((subcategory) => (
                                      <SelectItem key={subcategory.id} value={subcategory.id}>
                                        {subcategory.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Parsing History</span>
                    {parsingHistory.length > 0 && (
                      <Button variant="outline" size="sm" onClick={clearHistory}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {parsingHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No parsing history yet. Parse JSON data to get started.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {parsingHistory.map((record) => (
                        <div key={record.id} className="flex items-center justify-between p-3 border rounded-md">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Badge {...getStatusBadgeProps(record.status)}>
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
                            {record.status === 'success' && record.extracted_json && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {record.extracted_json.length} transactions extracted
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
            </TabsContent>
          </Tabs>
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
                  <Badge {...getStatusBadgeProps(selectedRecord.status)}>
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

              <div>
                <Label>JSON Input</Label>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                  {selectedRecord.openai_response?.original_input || atob(selectedRecord.image_data || '')}
                </pre>
              </div>

              {selectedRecord.extracted_json && (
                <div>
                  <Label>Extracted Data</Label>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                  {JSON.stringify(selectedRecord.extracted_json, null, 2)}
                </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}