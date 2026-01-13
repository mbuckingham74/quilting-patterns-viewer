-- Add zip_storage_path column to upload_logs table
-- This stores the path to the raw ZIP file in storage for backup/recovery
-- Run this migration in Supabase SQL Editor

ALTER TABLE upload_logs
ADD COLUMN IF NOT EXISTS zip_storage_path TEXT;

-- Add comment for documentation
COMMENT ON COLUMN upload_logs.zip_storage_path IS 'Path to the raw ZIP file stored in patterns bucket (e.g. uploads/2026-01-13T12-00-00-000Z_vendor-patterns.zip)';
