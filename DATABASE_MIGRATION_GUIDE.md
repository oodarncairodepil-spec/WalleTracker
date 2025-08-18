# Database Migration Guide: Renaming bulk_orders to json_parser_orders

This guide explains how to rename the `bulk_orders` table to `json_parser_orders` in your Supabase database.

## Prerequisites

- Access to your Supabase dashboard
- Admin privileges on the database
- Backup of your current data (recommended)

## Migration Steps

### Step 1: Backup Your Data (Recommended)

Before making any changes, create a backup of your `bulk_orders` table:

```sql
-- Create a backup table
CREATE TABLE bulk_orders_backup AS SELECT * FROM bulk_orders;
```

### Step 2: Run the Migration Script

Execute the following SQL commands in your Supabase SQL Editor:

```sql
-- Rename the main table
ALTER TABLE IF EXISTS bulk_orders RENAME TO json_parser_orders;

-- Rename the items table if it exists
ALTER TABLE IF EXISTS bulk_order_items RENAME TO json_parser_order_items;

-- Update the foreign key reference in the items table
ALTER TABLE IF EXISTS json_parser_order_items 
RENAME COLUMN bulk_order_id TO json_parser_order_id;
```

### Step 3: Update Indexes and Constraints

Rename indexes to match the new table name:

```sql
-- Rename indexes
ALTER INDEX IF EXISTS idx_bulk_orders_user_id 
RENAME TO idx_json_parser_orders_user_id;

ALTER INDEX IF EXISTS idx_bulk_orders_status 
RENAME TO idx_json_parser_orders_status;

ALTER INDEX IF EXISTS idx_bulk_orders_created_at 
RENAME TO idx_json_parser_orders_created_at;
```

### Step 4: Update Row Level Security Policies

Update RLS policies to reference the new table name:

```sql
-- Drop old policies
DROP POLICY IF EXISTS "Users can view own bulk orders" ON json_parser_orders;
DROP POLICY IF EXISTS "Users can insert own bulk orders" ON json_parser_orders;
DROP POLICY IF EXISTS "Users can update own bulk orders" ON json_parser_orders;
DROP POLICY IF EXISTS "Users can delete own bulk orders" ON json_parser_orders;

-- Create new policies with updated names
CREATE POLICY "Users can view own json parser orders" ON json_parser_orders
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own json parser orders" ON json_parser_orders
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own json parser orders" ON json_parser_orders
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own json parser orders" ON json_parser_orders
FOR DELETE USING (auth.uid() = user_id);
```

### Step 5: Update Triggers

Rename triggers to match the new table:

```sql
-- Drop old trigger
DROP TRIGGER IF EXISTS update_bulk_orders_updated_at ON json_parser_orders;

-- Create new trigger
CREATE TRIGGER update_json_parser_orders_updated_at
BEFORE UPDATE ON json_parser_orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## Verification

After running the migration, verify that everything is working correctly:

1. **Check table exists:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_name = 'json_parser_orders';
   ```

2. **Verify data integrity:**
   ```sql
   SELECT COUNT(*) FROM json_parser_orders;
   ```

3. **Test application functionality:**
   - Try creating a new JSON parser order
   - Verify existing orders are still accessible
   - Test update and delete operations

## Rollback (If Needed)

If you need to rollback the changes:

```sql
-- Rename back to original names
ALTER TABLE IF EXISTS json_parser_orders RENAME TO bulk_orders;
ALTER TABLE IF EXISTS json_parser_order_items RENAME TO bulk_order_items;
ALTER TABLE IF EXISTS bulk_order_items 
RENAME COLUMN json_parser_order_id TO bulk_order_id;

-- Restore original indexes and policies
-- (Run the reverse of the above commands)
```

## Notes

- The application code has already been updated to use the new table name `json_parser_orders`
- Make sure to test thoroughly in a development environment before applying to production
- Consider running this migration during low-traffic periods
- The migration script `json-parser-schema.sql` contains the basic rename command

## Files Updated

- `src/services/json-parser-service.ts` - Updated all database queries to use new table name
- `json-parser-schema.sql` - Contains the basic migration script