"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Separator } from "./ui/separator";
import { toast } from "sonner";
import { Wallet, Plus, TrendingUp, TrendingDown, Filter, Trash2, Calendar } from "lucide-react";
import { transactionService } from "../lib/supabase-service";
import { categoriesService } from "../services/categories-service";
import { isSupabaseConfigured } from "../lib/supabase";
import { useAuth } from "../contexts/auth-context";
import { formatIDR } from "../lib/utils";
import type { Category } from "../lib/supabase";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  date: string;
}

// Fallback categories if database is not available
const fallbackCategories = {
  expense: [
    { value: 'food', label: 'Food & Dining' },
    { value: 'transport', label: 'Transportation' },
    { value: 'shopping', label: 'Shopping' },
    { value: 'entertainment', label: 'Entertainment' },
    { value: 'bills', label: 'Bills & Utilities' },
    { value: 'health', label: 'Healthcare' },
    { value: 'education', label: 'Education' },
    { value: 'travel', label: 'Travel' },
    { value: 'other', label: 'Other' },
  ],
  income: [
    { value: 'salary', label: 'Salary' },
    { value: 'freelance', label: 'Freelance' },
    { value: 'business', label: 'Business' },
    { value: 'investment', label: 'Investment' },
    { value: 'gift', label: 'Gift' },
    { value: 'other', label: 'Other' },
  ],
};

export function ExpenseTracker() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load transactions and categories from Supabase on mount
  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      loadTransactions();
      loadCategories();
    } else {
      // Fallback to localStorage if not authenticated or Supabase not configured
      const saved = localStorage.getItem('walletracker-transactions');
      if (saved) {
        setTransactions(JSON.parse(saved));
      }
      setLoading(false);
    }
  }, [user]);

  // Save to localStorage as backup when transactions change
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('walletracker-transactions', JSON.stringify(transactions));
    }
  }, [transactions, loading]);

  const loadTransactions = async () => {
    try {
      const { data, error } = await transactionService.getTransactions();
      if (error) {
        console.error('Error loading transactions:', error);
        toast.error('Failed to load transactions');
        // Fallback to localStorage
        const saved = localStorage.getItem('walletracker-transactions');
        if (saved) {
          setTransactions(JSON.parse(saved));
        }
      } else {
        setTransactions(data || []);
      }
    } catch (error) {
      console.error('Error loading transactions:', error instanceof Error ? error.message : String(error));
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await categoriesService.getCategories(user?.id || '');
      if (error) {
        console.error('Error loading categories:', error);
        // Use fallback categories
        const fallbackCategoriesList: Category[] = [
          ...fallbackCategories.expense.map((cat, index) => ({
          id: `fallback-expense-${index}`,
          user_id: user?.id || '',
          name: cat.label,
          type: 'expense' as const,
          budget_amount: 0,
          budget_period: 'monthly' as const,
          is_active: true
        })),
        ...fallbackCategories.income.map((cat, index) => ({
          id: `fallback-income-${index}`,
          user_id: user?.id || '',
          name: cat.label,
          type: 'income' as const,
          budget_amount: 0,
          budget_period: 'monthly' as const,
          is_active: true
        }))
        ];
        setCategories(fallbackCategoriesList);
      } else {
        setCategories(data || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error instanceof Error ? error.message : String(error));
      // Use fallback categories
      const fallbackCategoriesList: Category[] = [
        ...fallbackCategories.expense.map((cat, index) => ({
          id: `fallback-expense-${index}`,
          user_id: user?.id || '',
          name: cat.label,
          type: 'expense' as const,
          budget_amount: 0,
          budget_period: 'monthly' as const,
          is_active: true
        })),
        ...fallbackCategories.income.map((cat, index) => ({
          id: `fallback-income-${index}`,
          user_id: user?.id || '',
          name: cat.label,
          type: 'income' as const,
          budget_amount: 0,
          budget_period: 'monthly' as const,
          is_active: true
        }))
      ];
      setCategories(fallbackCategoriesList);
    }
  };

  // Helper function to get categories by type
  const getCategoriesByType = (categoryType: 'income' | 'expense') => {
    return categories.filter(cat => cat.type === categoryType);
  };

  const addTransaction = async () => {
    if (!description.trim() || !amount || !category) {
      toast.error('Please fill in all fields');
      return;
    }

    const numAmount = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const transactionData = {
      description,
      amount: type === 'expense' ? -Math.abs(numAmount) : Math.abs(numAmount),
      category,
      type,
      date: new Date().toISOString(),
      status: 'paid' as const,
    };

    if (user && isSupabaseConfigured()) {
      try {
        const { data, error } = await transactionService.addTransaction(transactionData);
        if (error) {
          console.error('Error adding transaction:', error);
          toast.error('Failed to add transaction');
          return;
        }
        if (data) {
          setTransactions(prev => [data, ...prev]);
        }
      } catch (error) {
        console.error('Error adding transaction:', error instanceof Error ? error.message : String(error));
        toast.error('Failed to add transaction');
        return;
      }
    } else {
      // Fallback to localStorage
      const transaction: Transaction = {
        id: Date.now().toString(),
        ...transactionData,
      };
      setTransactions(prev => [transaction, ...prev]);
    }

    setDescription('');
    setAmount('');
    setCategory('');
    setIsDialogOpen(false);
    toast.success('Transaction added successfully!');
  };

  const deleteTransaction = async (id: string) => {
    if (user && isSupabaseConfigured()) {
      try {
        const { error } = await transactionService.deleteTransaction(id);
        if (error) {
          console.error('Error deleting transaction:', error);
          toast.error('Failed to delete transaction');
          return;
        }
      } catch (error) {
        console.error('Error deleting transaction:', error instanceof Error ? error.message : String(error));
        toast.error('Failed to delete transaction');
        return;
      }
    }
    
    setTransactions(prev => prev.filter(t => t.id !== id));
    toast.success('Transaction deleted');
  };

  const clearAllTransactions = () => {
    if (transactions.length === 0) {
      toast.info('No transactions to clear');
      return;
    }
    setTransactions([]);
    toast.success('All transactions cleared');
  };

  const filteredTransactions = transactions.filter(transaction => {
    const categoryMatch = filterCategory === 'all' || transaction.category === filterCategory;
    const typeMatch = filterType === 'all' || transaction.type === filterType;
    return categoryMatch && typeMatch;
  });

  const income = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = Math.abs(transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + t.amount, 0));

  const balance = income - expenses;

  const formatCurrency = (amount: number) => {
    return formatIDR(amount);
  };



  const getCategoryLabel = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Other';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-md space-y-6">
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-2xl">
              <Wallet className="h-8 w-8" />
              WalleTracker
            </CardTitle>
            <div className="mt-4">
              <p className="text-blue-100 text-sm">Loading...</p>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-md space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-2xl">
            <Wallet className="h-8 w-8" />
            WalleTracker
          </CardTitle>
          <div className="mt-4">
            <p className="text-blue-100 text-sm">Current Balance</p>
            <p className={`text-3xl font-bold ${balance >= 0 ? 'text-green-200' : 'text-red-200'}`}>
              {formatCurrency(balance)}
            </p>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-green-100 rounded-full">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Income</p>
                <p className="text-lg font-semibold text-green-600">{formatCurrency(income)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-red-100 rounded-full">
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Expenses</p>
                <p className="text-lg font-semibold text-red-600">{formatCurrency(expenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Transaction Button */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full" size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Transaction</DialogTitle>
            <DialogDescription>
              Fill in the details to add a new transaction to your records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="Enter description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="text"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                }}
                onBlur={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '')
                  const formatted = value ? parseInt(value).toLocaleString('id-ID') : ''
                  setAmount(formatted)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant={type === 'expense' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setType('expense');
                    setCategory('');
                  }}
                >
                  Expense
                </Button>
                <Button
                  type="button"
                  variant={type === 'income' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setType('income');
                    setCategory('');
                  }}
                >
                  Income
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {getCategoriesByType(type).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={addTransaction} className="w-full">
              Add Transaction
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expenses</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
            {transactions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllTransactions}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground px-6">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No transactions found</p>
              <p className="text-sm">
                {transactions.length === 0
                  ? 'Add your first transaction above'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transaction) => (
                    <TableRow key={transaction.id} className="hover:bg-muted/50">

                      <TableCell className="font-medium">
                        {transaction.description}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getCategoryLabel(transaction.category)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(transaction.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={transaction.type === 'income' ? 'default' : 'destructive'}
                          className={transaction.type === 'income' ? 'bg-green-600' : ''}
                        >
                          {transaction.type === 'income' ? '+' : ''}
                          {formatCurrency(Math.abs(transaction.amount))}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteTransaction(transaction.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}