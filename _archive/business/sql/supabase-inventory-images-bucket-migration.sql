-- Inventory item images bucket (used by Katana Inventory item detail uploads)
-- Run in Supabase SQL Editor if image uploads fail with bucket-not-found.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inventory-files',
  'inventory-files',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "inventory_files_insert" ON storage.objects;
CREATE POLICY "inventory_files_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'inventory-files');

DROP POLICY IF EXISTS "inventory_files_select" ON storage.objects;
CREATE POLICY "inventory_files_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'inventory-files');

DROP POLICY IF EXISTS "inventory_files_delete" ON storage.objects;
CREATE POLICY "inventory_files_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'inventory-files');
