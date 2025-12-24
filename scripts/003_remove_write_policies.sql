-- Migration: Lock down RLS policies (SELECT to authenticated, remove writes)
-- Run this in Supabase SQL Editor to apply all security fixes
--
-- This migration is IDEMPOTENT and SELF-CONTAINED - safe to run multiple times,
-- no dependencies on other migration files.
--
-- What this does:
-- 1. Restricts SELECT to authenticated users only (no anonymous access)
-- 2. Removes INSERT/UPDATE policies (only service role can write)
--
-- Note: Service role bypasses RLS entirely, so migration scripts still work.

-- ============================================
-- 1. FIX SELECT POLICIES - Restrict to authenticated users
-- ============================================

-- Drop all existing SELECT policies (both old and new names for idempotency)
DROP POLICY IF EXISTS "Patterns are viewable by everyone" ON patterns;
DROP POLICY IF EXISTS "Patterns are viewable by authenticated users" ON patterns;
DROP POLICY IF EXISTS "Keywords are viewable by everyone" ON keywords;
DROP POLICY IF EXISTS "Keywords are viewable by authenticated users" ON keywords;
DROP POLICY IF EXISTS "Pattern keywords are viewable by everyone" ON pattern_keywords;
DROP POLICY IF EXISTS "Pattern keywords are viewable by authenticated users" ON pattern_keywords;
DROP POLICY IF EXISTS "Keyword groups are viewable by everyone" ON keyword_groups;
DROP POLICY IF EXISTS "Keyword groups are viewable by authenticated users" ON keyword_groups;
DROP POLICY IF EXISTS "Keyword group keywords are viewable by everyone" ON keyword_group_keywords;
DROP POLICY IF EXISTS "Keyword group keywords are viewable by authenticated users" ON keyword_group_keywords;

-- Create new authenticated-only SELECT policies
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
-- 2. REMOVE WRITE POLICIES - Only service role can write
-- ============================================

-- Drop overly-permissive INSERT/UPDATE policies on tables
DROP POLICY IF EXISTS "Service role can insert patterns" ON patterns;
DROP POLICY IF EXISTS "Service role can update patterns" ON patterns;
DROP POLICY IF EXISTS "Service role can insert keywords" ON keywords;
DROP POLICY IF EXISTS "Service role can insert pattern keywords" ON pattern_keywords;
DROP POLICY IF EXISTS "Service role can insert keyword groups" ON keyword_groups;
DROP POLICY IF EXISTS "Service role can insert keyword group keywords" ON keyword_group_keywords;

-- Drop overly-permissive INSERT policies on storage
DROP POLICY IF EXISTS "Service role can upload thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Service role can upload patterns" ON storage.objects;

-- ============================================
-- Done! Database is now locked down:
-- - Anonymous users cannot query data
-- - Only service role can write to tables and storage
-- ============================================
