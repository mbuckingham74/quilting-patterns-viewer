-- Migration: Restrict SELECT policies to authenticated users only
-- Run this in Supabase SQL Editor to update existing policies
--
-- This migration is IDEMPOTENT - safe to run multiple times.
--
-- Why: The original policies allowed anonymous users to query data directly,
-- which conflicts with the "authorized users only" messaging in the app.
-- While the app redirects unauthenticated users, they could still query
-- the Supabase API directly with the anon key.
--
-- Note: All pattern/keyword reads in this app require authentication.
-- The browse page, pattern detail, and download endpoints all check auth.

-- ============================================
-- 1. DROP existing policies (both old and new names for idempotency)
-- ============================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "Patterns are viewable by everyone" ON patterns;
DROP POLICY IF EXISTS "Keywords are viewable by everyone" ON keywords;
DROP POLICY IF EXISTS "Pattern keywords are viewable by everyone" ON pattern_keywords;
DROP POLICY IF EXISTS "Keyword groups are viewable by everyone" ON keyword_groups;
DROP POLICY IF EXISTS "Keyword group keywords are viewable by everyone" ON keyword_group_keywords;

-- Drop new policies too (in case migration is re-run)
DROP POLICY IF EXISTS "Patterns are viewable by authenticated users" ON patterns;
DROP POLICY IF EXISTS "Keywords are viewable by authenticated users" ON keywords;
DROP POLICY IF EXISTS "Pattern keywords are viewable by authenticated users" ON pattern_keywords;
DROP POLICY IF EXISTS "Keyword groups are viewable by authenticated users" ON keyword_groups;
DROP POLICY IF EXISTS "Keyword group keywords are viewable by authenticated users" ON keyword_group_keywords;

-- ============================================
-- 2. CREATE new authenticated-only SELECT policies
-- ============================================

CREATE POLICY "Patterns are viewable by authenticated users"
  ON patterns FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Keywords are viewable by authenticated users"
  ON keywords FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Pattern keywords are viewable by authenticated users"
  ON pattern_keywords FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Keyword groups are viewable by authenticated users"
  ON keyword_groups FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Keyword group keywords are viewable by authenticated users"
  ON keyword_group_keywords FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Done! Anonymous users can no longer query data.
-- Service role still bypasses RLS for migrations.
-- ============================================
