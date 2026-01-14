-- Migration: Create view_logs table for tracking pattern detail page views
-- Run this on Supabase to enable view tracking

-- Track pattern views (when users visit pattern detail page)
CREATE TABLE view_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pattern_id INT REFERENCES patterns(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_view_logs_pattern ON view_logs(pattern_id);
CREATE INDEX idx_view_logs_user ON view_logs(user_id);
CREATE INDEX idx_view_logs_date ON view_logs(viewed_at);

-- RLS policies (same pattern as download_logs)
ALTER TABLE view_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all view logs
CREATE POLICY "Admins can read view_logs" ON view_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Allow authenticated users to insert their own view logs
CREATE POLICY "Users can log views" ON view_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
