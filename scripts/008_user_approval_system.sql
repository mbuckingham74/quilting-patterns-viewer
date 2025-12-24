-- Migration: User Approval System
-- Adds profiles table with approval status and admin role
-- Updates RLS policies so only approved users can view patterns

-- Admin email addresses (will be auto-approved)
-- michael.buckingham74@gmail.com
-- pamncharlie@gmail.com

-- User profiles with approval status and admin role
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  display_name TEXT,
  is_approved BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON profiles(is_approved);
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Service can insert profiles" ON profiles;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Admins can update profiles (for approval)
CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Anyone authenticated can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Update RLS on patterns: only APPROVED users can view
DROP POLICY IF EXISTS "Patterns are viewable by authenticated users" ON patterns;
DROP POLICY IF EXISTS "Patterns viewable by approved users" ON patterns;
CREATE POLICY "Patterns viewable by approved users" ON patterns
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

-- Update RLS on keywords: only APPROVED users can view
DROP POLICY IF EXISTS "Keywords are viewable by authenticated users" ON keywords;
DROP POLICY IF EXISTS "Keywords viewable by approved users" ON keywords;
CREATE POLICY "Keywords viewable by approved users" ON keywords
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

-- Update RLS on pattern_keywords: only APPROVED users can view
DROP POLICY IF EXISTS "Pattern keywords viewable by authenticated users" ON pattern_keywords;
DROP POLICY IF EXISTS "Pattern keywords viewable by approved users" ON pattern_keywords;
CREATE POLICY "Pattern keywords viewable by approved users" ON pattern_keywords
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

-- Update RLS on user_favorites: only APPROVED users can access
DROP POLICY IF EXISTS "Users can view own favorites" ON user_favorites;
DROP POLICY IF EXISTS "Users can insert own favorites" ON user_favorites;
DROP POLICY IF EXISTS "Users can delete own favorites" ON user_favorites;

CREATE POLICY "Users can view own favorites" ON user_favorites
  FOR SELECT USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

CREATE POLICY "Users can insert own favorites" ON user_favorites
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

CREATE POLICY "Users can delete own favorites" ON user_favorites
  FOR DELETE USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

-- Update RLS on saved_searches: only APPROVED users can access
DROP POLICY IF EXISTS "Users can view own searches" ON saved_searches;
DROP POLICY IF EXISTS "Users can insert own searches" ON saved_searches;
DROP POLICY IF EXISTS "Users can delete own searches" ON saved_searches;

CREATE POLICY "Users can view own searches" ON saved_searches
  FOR SELECT USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

CREATE POLICY "Users can insert own searches" ON saved_searches
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );

CREATE POLICY "Users can delete own searches" ON saved_searches
  FOR DELETE USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_approved = true)
  );
