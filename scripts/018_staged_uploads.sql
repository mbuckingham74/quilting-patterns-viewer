-- Migration: Add staged upload workflow support
-- Run this in Supabase SQL Editor

-- Add staging columns to patterns table
ALTER TABLE patterns ADD COLUMN IF NOT EXISTS is_staged BOOLEAN DEFAULT false;
ALTER TABLE patterns ADD COLUMN IF NOT EXISTS upload_batch_id INTEGER REFERENCES upload_logs(id) ON DELETE SET NULL;

-- Add status column to upload_logs for batch state tracking
ALTER TABLE upload_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'committed';

-- Add check constraint for valid status values (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'upload_logs_status_check'
  ) THEN
    ALTER TABLE upload_logs ADD CONSTRAINT upload_logs_status_check
      CHECK (status IN ('staged', 'committed', 'cancelled'));
  END IF;
END $$;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_patterns_upload_batch ON patterns(upload_batch_id) WHERE upload_batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patterns_staged ON patterns(is_staged) WHERE is_staged = true;
CREATE INDEX IF NOT EXISTS idx_upload_logs_status ON upload_logs(status);

-- Update RLS policy: hide staged patterns from non-admin users in browse
-- First, drop existing policy if it exists
DROP POLICY IF EXISTS "Patterns are viewable by authenticated users" ON patterns;

-- Create updated policy that hides staged patterns from non-admins
CREATE POLICY "Patterns are viewable by authenticated users"
  ON patterns FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND (
      is_staged = false
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
      )
    )
  );

-- Mark existing patterns as not staged (in case column was added with NULL)
UPDATE patterns SET is_staged = false WHERE is_staged IS NULL;

-- Mark existing upload_logs as committed
UPDATE upload_logs SET status = 'committed' WHERE status IS NULL;
