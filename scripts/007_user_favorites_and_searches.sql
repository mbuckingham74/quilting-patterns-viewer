-- Migration: User Favorites and Saved Searches
-- Adds tables for users to save favorite patterns and AI search queries

-- User favorites (starred patterns)
CREATE TABLE IF NOT EXISTS user_favorites (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pattern_id INTEGER REFERENCES patterns(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pattern_id)
);

-- Saved AI search queries
CREATE TABLE IF NOT EXISTS saved_searches (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  query TEXT NOT NULL,
  name TEXT,  -- Optional user-friendly name
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_favorites_user ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_pattern ON user_favorites(pattern_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);

-- Enable Row Level Security
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_favorites
-- Users can only view their own favorites
DROP POLICY IF EXISTS "Users can view own favorites" ON user_favorites;
CREATE POLICY "Users can view own favorites" ON user_favorites
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert favorites for themselves
DROP POLICY IF EXISTS "Users can insert own favorites" ON user_favorites;
CREATE POLICY "Users can insert own favorites" ON user_favorites
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own favorites
DROP POLICY IF EXISTS "Users can delete own favorites" ON user_favorites;
CREATE POLICY "Users can delete own favorites" ON user_favorites
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for saved_searches
-- Users can only view their own saved searches
DROP POLICY IF EXISTS "Users can view own searches" ON saved_searches;
CREATE POLICY "Users can view own searches" ON saved_searches
  FOR SELECT USING (auth.uid() = user_id);

-- Users can only insert saved searches for themselves
DROP POLICY IF EXISTS "Users can insert own searches" ON saved_searches;
CREATE POLICY "Users can insert own searches" ON saved_searches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own saved searches
DROP POLICY IF EXISTS "Users can delete own searches" ON saved_searches;
CREATE POLICY "Users can delete own searches" ON saved_searches
  FOR DELETE USING (auth.uid() = user_id);
