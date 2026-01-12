-- Migration: Create analytics tracking tables
-- Run this on Supabase to enable download and search logging

-- Track pattern downloads
CREATE TABLE download_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pattern_id INT REFERENCES patterns(id) ON DELETE CASCADE,
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_download_logs_pattern ON download_logs(pattern_id);
CREATE INDEX idx_download_logs_user ON download_logs(user_id);
CREATE INDEX idx_download_logs_date ON download_logs(downloaded_at);

-- Track search queries
CREATE TABLE search_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  search_method TEXT NOT NULL, -- 'semantic' or 'text'
  result_count INT NOT NULL,
  searched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_search_logs_user ON search_logs(user_id);
CREATE INDEX idx_search_logs_date ON search_logs(searched_at);
CREATE INDEX idx_search_logs_query ON search_logs USING gin(to_tsvector('english', query));

-- RLS policies (admins can read, authenticated users can insert their own)
ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all download logs
CREATE POLICY "Admins can read download_logs" ON download_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Admins can read all search logs
CREATE POLICY "Admins can read search_logs" ON search_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Allow authenticated users to insert their own logs
CREATE POLICY "Users can log downloads" ON download_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can log searches" ON search_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
