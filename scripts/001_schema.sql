-- Quilting Pattern Manager Database Schema
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. TABLES
-- ============================================

-- Main patterns table
CREATE TABLE patterns (
  id INTEGER PRIMARY KEY,
  file_name TEXT,
  file_extension TEXT,
  file_size INTEGER,
  author TEXT,
  author_url TEXT,
  author_notes TEXT,
  notes TEXT,
  thumbnail_url TEXT,
  pattern_file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Keywords for filtering
CREATE TABLE keywords (
  id INTEGER PRIMARY KEY,
  value TEXT NOT NULL UNIQUE
);

-- Pattern-keyword junction table (many-to-many)
CREATE TABLE pattern_keywords (
  pattern_id INTEGER REFERENCES patterns(id) ON DELETE CASCADE,
  keyword_id INTEGER REFERENCES keywords(id) ON DELETE CASCADE,
  PRIMARY KEY (pattern_id, keyword_id)
);

-- Optional: Keyword groups for organized filtering UI
CREATE TABLE keyword_groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE keyword_group_keywords (
  keyword_group_id INTEGER REFERENCES keyword_groups(id) ON DELETE CASCADE,
  keyword_id INTEGER REFERENCES keywords(id) ON DELETE CASCADE,
  PRIMARY KEY (keyword_group_id, keyword_id)
);

-- ============================================
-- 2. INDEXES (for fast searching)
-- ============================================

CREATE INDEX idx_patterns_file_extension ON patterns(file_extension);
CREATE INDEX idx_patterns_author ON patterns(author);
CREATE INDEX idx_patterns_file_name ON patterns(file_name);
CREATE INDEX idx_keywords_value ON keywords(value);
CREATE INDEX idx_pattern_keywords_pattern ON pattern_keywords(pattern_id);
CREATE INDEX idx_pattern_keywords_keyword ON pattern_keywords(keyword_id);

-- Full-text search index for pattern names and notes
CREATE INDEX idx_patterns_search ON patterns
  USING GIN (to_tsvector('english', coalesce(file_name, '') || ' ' || coalesce(notes, '') || ' ' || coalesce(author, '')));

-- ============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_group_keywords ENABLE ROW LEVEL SECURITY;

-- Patterns: Anyone can view, only service role can modify
CREATE POLICY "Patterns are viewable by everyone"
  ON patterns FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert patterns"
  ON patterns FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update patterns"
  ON patterns FOR UPDATE
  USING (true);

-- Keywords: Anyone can view
CREATE POLICY "Keywords are viewable by everyone"
  ON keywords FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert keywords"
  ON keywords FOR INSERT
  WITH CHECK (true);

-- Pattern Keywords: Anyone can view
CREATE POLICY "Pattern keywords are viewable by everyone"
  ON pattern_keywords FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert pattern keywords"
  ON pattern_keywords FOR INSERT
  WITH CHECK (true);

-- Keyword Groups: Anyone can view
CREATE POLICY "Keyword groups are viewable by everyone"
  ON keyword_groups FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert keyword groups"
  ON keyword_groups FOR INSERT
  WITH CHECK (true);

-- Keyword Group Keywords: Anyone can view
CREATE POLICY "Keyword group keywords are viewable by everyone"
  ON keyword_group_keywords FOR SELECT
  USING (true);

CREATE POLICY "Service role can insert keyword group keywords"
  ON keyword_group_keywords FOR INSERT
  WITH CHECK (true);

-- ============================================
-- 4. STORAGE BUCKETS
-- ============================================

-- Create storage bucket for thumbnails (public access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for pattern files (authenticated access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('patterns', 'patterns', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for thumbnails (public read)
CREATE POLICY "Thumbnails are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'thumbnails');

CREATE POLICY "Service role can upload thumbnails"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'thumbnails');

-- Storage policies for pattern files (authenticated download)
CREATE POLICY "Authenticated users can download patterns"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'patterns' AND auth.role() = 'authenticated');

CREATE POLICY "Service role can upload patterns"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'patterns');

-- ============================================
-- Done! Tables, indexes, RLS policies, and
-- storage buckets are now configured.
-- ============================================
