-- Rename bulk_orders table to json_parser_orders
ALTER TABLE IF EXISTS bulk_orders RENAME TO json_parser_orders;

-- Rename bulk_order_items table to json_parser_order_items
ALTER TABLE IF EXISTS bulk_order_items RENAME TO json_parser_order_items;

-- Update foreign key reference in json_parser_order_items
ALTER TABLE IF EXISTS json_parser_order_items 
RENAME COLUMN bulk_order_id TO json_parser_order_id;

-- Update RLS policies for json_parser_orders
DROP POLICY IF EXISTS "Users can view own bulk orders" ON json_parser_orders;
DROP POLICY IF EXISTS "Users can insert own bulk orders" ON json_parser_orders;
DROP POLICY IF EXISTS "Users can update own bulk orders" ON json_parser_orders;
DROP POLICY IF EXISTS "Users can delete own bulk orders" ON json_parser_orders;

CREATE POLICY "Users can view own json parser orders" ON json_parser_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own json parser orders" ON json_parser_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own json parser orders" ON json_parser_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own json parser orders" ON json_parser_orders
  FOR DELETE USING (auth.uid() = user_id);

-- Update RLS policies for json_parser_order_items
DROP POLICY IF EXISTS "Users can view own bulk order items" ON json_parser_order_items;
DROP POLICY IF EXISTS "Users can insert own bulk order items" ON json_parser_order_items;
DROP POLICY IF EXISTS "Users can update own bulk order items" ON json_parser_order_items;
DROP POLICY IF EXISTS "Users can delete own bulk order items" ON json_parser_order_items;

CREATE POLICY "Users can view own json parser order items" ON json_parser_order_items
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM json_parser_orders WHERE id = json_parser_order_id));

CREATE POLICY "Users can insert own json parser order items" ON json_parser_order_items
  FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM json_parser_orders WHERE id = json_parser_order_id));

CREATE POLICY "Users can update own json parser order items" ON json_parser_order_items
  FOR UPDATE USING (auth.uid() = (SELECT user_id FROM json_parser_orders WHERE id = json_parser_order_id));

CREATE POLICY "Users can delete own json parser order items" ON json_parser_order_items
  FOR DELETE USING (auth.uid() = (SELECT user_id FROM json_parser_orders WHERE id = json_parser_order_id));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_json_parser_orders_user_id ON json_parser_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_json_parser_order_items_order_id ON json_parser_order_items(json_parser_order_id);