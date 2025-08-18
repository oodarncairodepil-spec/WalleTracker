-- Create bulk_orders table
CREATE TABLE IF NOT EXISTS bulk_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  total_amount BIGINT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')) DEFAULT 'pending' NOT NULL,
  source_of_funds_id UUID REFERENCES funds(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bulk_order_items table
CREATE TABLE IF NOT EXISTS bulk_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bulk_order_id UUID REFERENCES bulk_orders(id) ON DELETE CASCADE NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price BIGINT NOT NULL,
  total_price BIGINT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE bulk_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulk_order_items ENABLE ROW LEVEL SECURITY;

-- Create policies for bulk_orders
CREATE POLICY "Users can view own bulk orders" ON bulk_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bulk orders" ON bulk_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bulk orders" ON bulk_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bulk orders" ON bulk_orders
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for bulk_order_items
CREATE POLICY "Users can view own bulk order items" ON bulk_order_items
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM bulk_orders WHERE id = bulk_order_id));

CREATE POLICY "Users can insert own bulk order items" ON bulk_order_items
  FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM bulk_orders WHERE id = bulk_order_id));

CREATE POLICY "Users can update own bulk order items" ON bulk_order_items
  FOR UPDATE USING (auth.uid() = (SELECT user_id FROM bulk_orders WHERE id = bulk_order_id));

CREATE POLICY "Users can delete own bulk order items" ON bulk_order_items
  FOR DELETE USING (auth.uid() = (SELECT user_id FROM bulk_orders WHERE id = bulk_order_id));

-- Create triggers for updated_at
CREATE TRIGGER update_bulk_orders_updated_at
  BEFORE UPDATE ON bulk_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bulk_order_items_updated_at
  BEFORE UPDATE ON bulk_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bulk_orders_user_id ON bulk_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_bulk_orders_status ON bulk_orders(status);
CREATE INDEX IF NOT EXISTS idx_bulk_orders_created_at ON bulk_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bulk_order_items_bulk_order_id ON bulk_order_items(bulk_order_id);

-- Grant permissions
GRANT ALL ON bulk_orders TO authenticated;
GRANT ALL ON bulk_order_items TO authenticated;
GRANT ALL ON bulk_orders TO service_role;
GRANT ALL ON bulk_order_items TO service_role;