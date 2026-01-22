-- Migration: Pinned Keywords
-- Allows users to pin up to 10 keywords for quick access in the sidebar
-- Following the user_favorites pattern from 007_user_favorites_and_searches.sql

-- Pinned keywords table
CREATE TABLE IF NOT EXISTS pinned_keywords (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  keyword_id INTEGER REFERENCES keywords(id) ON DELETE CASCADE NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, keyword_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pinned_keywords_user ON pinned_keywords(user_id);
CREATE INDEX IF NOT EXISTS idx_pinned_keywords_keyword ON pinned_keywords(keyword_id);
CREATE INDEX IF NOT EXISTS idx_pinned_keywords_order ON pinned_keywords(user_id, display_order);

-- Enable Row Level Security
ALTER TABLE pinned_keywords ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pinned_keywords
-- Users can only view their own pinned keywords (must be approved)
DROP POLICY IF EXISTS "Users can view own pinned keywords" ON pinned_keywords;
CREATE POLICY "Users can view own pinned keywords" ON pinned_keywords
  FOR SELECT USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

-- Users can only insert pinned keywords for themselves (must be approved)
DROP POLICY IF EXISTS "Users can insert own pinned keywords" ON pinned_keywords;
CREATE POLICY "Users can insert own pinned keywords" ON pinned_keywords
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

-- Users can only update their own pinned keywords (must be approved)
DROP POLICY IF EXISTS "Users can update own pinned keywords" ON pinned_keywords;
CREATE POLICY "Users can update own pinned keywords" ON pinned_keywords
  FOR UPDATE USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  ) WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

-- Users can only delete their own pinned keywords (must be approved)
DROP POLICY IF EXISTS "Users can delete own pinned keywords" ON pinned_keywords;
CREATE POLICY "Users can delete own pinned keywords" ON pinned_keywords
  FOR DELETE USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

-- Function to check pin limit (max 10)
CREATE OR REPLACE FUNCTION check_pinned_keywords_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM pinned_keywords WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'Maximum of 10 pinned keywords allowed' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to enforce limit
DROP TRIGGER IF EXISTS enforce_pinned_keywords_limit ON pinned_keywords;
CREATE TRIGGER enforce_pinned_keywords_limit
  BEFORE INSERT ON pinned_keywords
  FOR EACH ROW EXECUTE FUNCTION check_pinned_keywords_limit();

-- Grant permissions (revoke from anon, allow authenticated)
REVOKE ALL ON pinned_keywords FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON pinned_keywords TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE pinned_keywords_id_seq TO authenticated;
