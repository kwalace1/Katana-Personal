ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS quantity_delta integer;
