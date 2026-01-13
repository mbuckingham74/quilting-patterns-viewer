-- Upload logs table to track pattern upload history
-- Run this migration in Supabase SQL Editor

-- Create upload_logs table
CREATE TABLE IF NOT EXISTS upload_logs (
  id SERIAL PRIMARY KEY,
  zip_filename TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Summary counts
  total_patterns INTEGER NOT NULL DEFAULT 0,
  uploaded_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,

  -- Detailed results stored as JSONB
  uploaded_patterns JSONB DEFAULT '[]'::jsonb,  -- [{id, name, hasThumbnail, thumbnailUrl, fileSize, author}]
  skipped_patterns JSONB DEFAULT '[]'::jsonb,   -- [{name, reason}]
  error_patterns JSONB DEFAULT '[]'::jsonb      -- [{name, error}]
);

-- Index for quick lookups by user and date
CREATE INDEX IF NOT EXISTS idx_upload_logs_uploaded_by ON upload_logs(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_upload_logs_uploaded_at ON upload_logs(uploaded_at DESC);

-- RLS policies
ALTER TABLE upload_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view upload logs
CREATE POLICY "Admins can view upload logs"
  ON upload_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Only service role can insert (API uses service client)
-- No insert policy needed for authenticated users since we use service client
