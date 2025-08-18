-- Remove emoji columns from database tables

-- Remove emoji column from main_categories table
ALTER TABLE main_categories DROP COLUMN IF EXISTS emoji;

-- Remove emoji column from subcategories table
ALTER TABLE subcategories DROP COLUMN IF EXISTS emoji;

-- Note: categories_with_hierarchy is likely a view, not a table
-- If it exists as a table, uncomment the line below:
-- ALTER TABLE categories_with_hierarchy DROP COLUMN IF EXISTS emoji;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'main_categories' 
AND table_schema = 'public';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'subcategories' 
AND table_schema = 'public';