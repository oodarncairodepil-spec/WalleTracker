# Budget System Implementation Guide

## Overview

The budget system enables period-based financial tracking and performance analysis. Users can set budgets for categories/subcategories, track actual spending, and analyze performance over time.

## Key Features

### 1. Period-Based Budgeting
- Support for monthly, weekly, yearly, and custom periods
- Automatic period detection based on user preferences
- Historical budget tracking for performance analysis

### 2. Category Integration
- Works with both main categories and subcategories
- Flexible budget allocation at any category level
- Automatic actual amount calculation from transactions

### 3. Performance Analytics
- Real-time variance calculation (actual vs budgeted)
- Performance classification (surplus, deficit, on-target)
- Aggregated summaries by period and category type

### 4. Historical Tracking
- Automatic period finalization and archiving
- Historical performance comparison
- Trend analysis capabilities

## Database Schema

### Tables Created

1. **`budgets`** - Active period budgets
2. **`budget_history`** - Finalized period archives
3. **`budget_performance_summary`** - Aggregated view

### Key Features
- Row Level Security (RLS) enabled
- Automatic variance calculations
- Performance status classification
- Optimized indexes for queries

## Implementation Steps

### Step 1: Create Database Tables

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Execute the script: `scripts/create-budget-tables.sql`

```sql
-- The script creates:
-- - budgets table with computed variance fields
-- - budget_history table for archives
-- - Performance summary view
-- - RLS policies and indexes
-- - Helper functions for period finalization
```

### Step 2: Import Budget Service

```typescript
import { budgetService } from '../services/budget-service'
import { Budget, BudgetHistory, BudgetPerformanceSummary } from '../lib/supabase'
```

### Step 3: Basic Usage Examples

#### Create a Budget
```typescript
const result = await budgetService.createBudget({
  period_start_date: '2025-09-03',
  period_end_date: '2025-10-02',
  period_type: 'custom',
  subcategory_id: 'category-uuid',
  category_name: 'Groceries',
  category_type: 'expense',
  budgeted_amount: 50000, // Amount in cents
  notes: 'Monthly grocery budget'
})
```

#### Get Current Period Performance
```typescript
const { data: performance } = await budgetService.getBudgetPerformanceSummary(
  '2025-09-03',
  '2025-10-02'
)

if (performance) {
  console.log('Net Budget:', performance.netBudgeted)
  console.log('Net Actual:', performance.netActual)
  console.log('Net Variance:', performance.netVariance)
  console.log('Income Performance:', performance.income)
  console.log('Expense Performance:', performance.expense)
}
```

#### Update Actual Amounts
```typescript
// Automatically calculate actual amounts from transactions
await budgetService.updateActualAmounts('2025-09-03', '2025-10-02')
```

#### Finalize Period
```typescript
// Move current period to history
await budgetService.finalizePeriod('2025-09-03', '2025-10-02')
```

## Integration with Existing Components

### Homepage Integration

```typescript
// In homepage.tsx
const [budgetPerformance, setBudgetPerformance] = useState<PeriodPerformance | null>(null)

useEffect(() => {
  const loadBudgetData = async () => {
    const currentPeriod = await dateRangeService.getCurrentPeriodRange()
    const { data } = await budgetService.getBudgetPerformanceSummary(
      currentPeriod.startDate,
      currentPeriod.endDate
    )
    setBudgetPerformance(data)
  }
  
  loadBudgetData()
}, [])
```

### Settings Integration

```typescript
// Add budget management to settings
const BudgetSettings = () => {
  const [budgets, setBudgets] = useState<Budget[]>([])
  
  const loadCurrentBudgets = async () => {
    const { data } = await budgetService.getCurrentPeriodBudgets()
    setBudgets(data || [])
  }
  
  const createNewBudget = async (budgetData: CreateBudgetRequest) => {
    await budgetService.createBudget(budgetData)
    loadCurrentBudgets() // Refresh
  }
  
  return (
    // Budget management UI
  )
}
```

## UI Components to Create

### 1. Budget Overview Card
```typescript
interface BudgetOverviewProps {
  performance: PeriodPerformance
}

const BudgetOverview: React.FC<BudgetOverviewProps> = ({ performance }) => {
  return (
    <div className="budget-overview">
      <h3>{performance.description}</h3>
      <div className="net-performance">
        <span>Net Budget: {formatCurrency(performance.netBudgeted)}</span>
        <span>Net Actual: {formatCurrency(performance.netActual)}</span>
        <span className={performance.netVariance >= 0 ? 'surplus' : 'deficit'}>
          Variance: {formatCurrency(performance.netVariance)}
        </span>
      </div>
    </div>
  )
}
```

### 2. Category Budget List
```typescript
const CategoryBudgetList: React.FC<{ budgets: Budget[] }> = ({ budgets }) => {
  return (
    <div className="category-budgets">
      {budgets.map(budget => (
        <div key={budget.id} className="budget-item">
          <span>{budget.category_name}</span>
          <div className="amounts">
            <span>Budget: {formatCurrency(budget.budgeted_amount)}</span>
            <span>Actual: {formatCurrency(budget.actual_amount)}</span>
            <span className={budget.variance_amount >= 0 ? 'over' : 'under'}>
              {budget.variance_percentage.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
```

### 3. Historical Performance Chart
```typescript
const PerformanceChart: React.FC = () => {
  const [history, setHistory] = useState<BudgetHistory[]>([])
  
  useEffect(() => {
    const loadHistory = async () => {
      const { data } = await budgetService.getBudgetHistory(12)
      setHistory(data || [])
    }
    loadHistory()
  }, [])
  
  // Render chart with historical performance data
  return <div>Performance Chart</div>
}
```

## Automation Features

### 1. Auto-Create Period Budgets
```typescript
// Call this when a new period starts
await budgetService.createCurrentPeriodBudgets()
```

### 2. Real-time Actual Updates
```typescript
// Call this after transaction changes
const currentPeriod = await dateRangeService.getCurrentPeriodRange()
await budgetService.updateActualAmounts(
  currentPeriod.startDate,
  currentPeriod.endDate
)
```

### 3. Period Auto-Finalization
```typescript
// Call this when period ends (can be automated)
const previousPeriod = await dateRangeService.getPeriodRange(1)
await budgetService.finalizePeriod(
  previousPeriod.startDate,
  previousPeriod.endDate
)
```

## Performance Considerations

1. **Caching**: Budget service includes built-in caching
2. **Indexes**: Optimized database indexes for common queries
3. **Computed Fields**: Variance calculations done at database level
4. **Batch Updates**: Efficient actual amount updates

## Security

- Row Level Security (RLS) ensures users only see their data
- All operations require authentication
- Proper foreign key constraints maintain data integrity

## Future Enhancements

1. **Budget Templates**: Save and reuse budget configurations
2. **Alerts**: Notifications when approaching budget limits
3. **Forecasting**: Predict future spending based on trends
4. **Goals**: Set and track financial goals
5. **Reporting**: Advanced analytics and export capabilities

## Troubleshooting

### Common Issues

1. **Missing Tables**: Ensure SQL script was executed successfully
2. **Permission Errors**: Check RLS policies are properly configured
3. **Cache Issues**: Clear cache if data seems stale
4. **Performance**: Check database indexes are created

### Debug Queries

```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('budgets', 'budget_history');

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('budgets', 'budget_history');

-- Check indexes
SELECT * FROM pg_indexes WHERE tablename IN ('budgets', 'budget_history');
```

This budget system provides a comprehensive foundation for financial performance tracking and can be extended based on specific user needs.