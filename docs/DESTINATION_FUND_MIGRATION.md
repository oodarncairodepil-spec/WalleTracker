# Database Migration: Add destination_fund_id Column

## Overview
This migration adds a `destination_fund_id` column to the `transactions` table to properly store the destination fund information for internal transfer transactions.

## Why This Migration is Needed
Previously, internal transfer transactions were linked using heuristics (matching amount, date, and type). This approach was unreliable and could fail when multiple internal transfers had the same amount and date. The new `destination_fund_id` column provides a direct reference to the destination fund, making internal transfer linking more robust.

## Migration Steps

### Step 1: Access Supabase SQL Editor
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Execute the Migration SQL
Copy and paste the following SQL code from `add-destination-fund-migration.sql` and click **Run**:

```sql
-- Migration: Add destination_fund_id column to transactions table
-- This column is needed to properly store the destination fund for internal transfers

-- Add the destination_fund_id column to the transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS destination_fund_id UUID REFERENCES funds(id) ON DELETE SET NULL;

-- Create an index for better performance when querying by destination fund
CREATE INDEX IF NOT EXISTS idx_transactions_destination_fund_id 
ON transactions(destination_fund_id);

-- Add a comment to document the purpose of this column
COMMENT ON COLUMN transactions.destination_fund_id IS 'References the destination fund for internal transfer transactions';
```

### Step 3: Verify Migration
After running the migration, verify that the column was added successfully:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'transactions' AND column_name = 'destination_fund_id';
```

You should see a result showing:
- `column_name`: destination_fund_id
- `data_type`: uuid
- `is_nullable`: YES

## What This Migration Fixes

1. **Reliable Internal Transfer Linking**: Internal transfers are now linked using direct foreign key references instead of heuristics
2. **Data Integrity**: The destination fund information is properly stored and maintained
3. **Better Performance**: Queries for internal transfers are more efficient with the new index
4. **Future-Proof**: The system can handle multiple internal transfers with the same amount and date

## After Migration

1. **Existing Internal Transfers**: Old internal transfers will continue to work using the fallback method
2. **New Internal Transfers**: All new internal transfers will use the `destination_fund_id` field for reliable linking
3. **Editing Existing Transfers**: When editing existing internal transfers and adding a destination fund, the system will properly create the corresponding income transaction

## Code Changes Included

1. **Transaction Interface**: Updated to include `destination_fund_id?: string`
2. **Transaction Creation**: Modified to store `destination_fund_id` for internal transfers
3. **Transaction Linking**: Enhanced `findLinkedInternalTransfer` function to use the new field
4. **Backward Compatibility**: Maintained fallback to old linking method for existing data

## Troubleshooting

If you encounter any issues:

1. **Permission Error**: Make sure you have admin access to your Supabase project
2. **Column Already Exists**: The migration uses `IF NOT EXISTS` so it's safe to run multiple times
3. **Foreign Key Error**: Ensure the `funds` table exists and has the correct structure

## Testing

After the migration:

1. Create a new internal transfer and verify both expense and income transactions are created
2. Edit an existing regular transaction and convert it to an internal transfer
3. Edit an existing internal transfer and verify synchronization works
4. Check that the `destination_fund_id` field is populated correctly

The migration is backward compatible and will not affect existing functionality.