-- Migration: Security Fixes
-- Date: 2026-01-17
-- Description: Fix security issues identified by Supabase security advisor
--
-- Issues addressed:
-- 1. admin_emails table has RLS but no policies
-- 2. Overly permissive SELECT policies allowing unauthenticated access
-- 3. Dangerous UPDATE policy on patterns table
-- 4. Excessive permissions granted to anon role

-- ============================================================================
-- 1. Fix admin_emails table (RLS enabled but no policies)
-- ============================================================================
-- This table stores admin email addresses for notifications.
-- Only admins should be able to read it.

CREATE POLICY "Admins can read admin_emails" ON admin_emails
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ));

-- ============================================================================
-- 2. Remove overly permissive "viewable by everyone" policies
-- ============================================================================
-- These policies allow unauthenticated (anon) users to read data.
-- The app requires authentication, so these should be restricted.

-- patterns: Remove public access, keep approved user access
DROP POLICY IF EXISTS "Patterns are viewable by everyone" ON patterns;

-- keywords: Remove public access, keep approved user access
DROP POLICY IF EXISTS "Keywords are viewable by everyone" ON keywords;

-- pattern_keywords: Remove public access, keep approved user access
DROP POLICY IF EXISTS "Pattern keywords are viewable by everyone" ON pattern_keywords;

-- keyword_groups: Add authenticated-only policy to replace public
DROP POLICY IF EXISTS "Keyword groups are viewable by everyone" ON keyword_groups;
CREATE POLICY "Keyword groups viewable by approved users" ON keyword_groups
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.is_approved = true
  ));

-- keyword_group_keywords: Add authenticated-only policy to replace public
DROP POLICY IF EXISTS "Keyword group keywords are viewable by everyone" ON keyword_group_keywords;
CREATE POLICY "Keyword group keywords viewable by approved users" ON keyword_group_keywords
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.is_approved = true
  ));

-- ============================================================================
-- 3. Fix dangerous UPDATE policy on patterns
-- ============================================================================
-- "Service role can update patterns" uses USING(true) with {public} role
-- Service role bypasses RLS anyway, so this policy is redundant and dangerous

DROP POLICY IF EXISTS "Service role can update patterns" ON patterns;

-- ============================================================================
-- 4. Revoke excessive anon permissions (defense in depth)
-- ============================================================================
-- Even though RLS blocks access, best practice is to only grant necessary perms.
-- The anon role should have minimal access since app requires authentication.

-- Revoke all permissions from anon on public tables
REVOKE ALL ON admin_activity_log FROM anon;
REVOKE ALL ON admin_emails FROM anon;
REVOKE ALL ON download_logs FROM anon;
REVOKE ALL ON duplicate_reviews FROM anon;
REVOKE ALL ON keyword_group_keywords FROM anon;
REVOKE ALL ON keyword_groups FROM anon;
REVOKE ALL ON keywords FROM anon;
REVOKE ALL ON mirror_analysis FROM anon;
REVOKE ALL ON orientation_analysis FROM anon;
REVOKE ALL ON pattern_keywords FROM anon;
REVOKE ALL ON pattern_similarities FROM anon;
REVOKE ALL ON patterns FROM anon;
REVOKE ALL ON profiles FROM anon;
REVOKE ALL ON saved_searches FROM anon;
REVOKE ALL ON search_logs FROM anon;
REVOKE ALL ON shared_collection_feedback FROM anon;
REVOKE ALL ON shared_collection_patterns FROM anon;
REVOKE ALL ON shared_collections FROM anon;
REVOKE ALL ON upload_logs FROM anon;
REVOKE ALL ON user_favorites FROM anon;
REVOKE ALL ON view_logs FROM anon;

-- ============================================================================
-- 5. Fix INSERT policies missing WITH CHECK clauses
-- ============================================================================
-- These policies allow INSERT but don't validate the data being inserted

-- download_logs: Users can only insert their own download logs
DROP POLICY IF EXISTS "Users can log downloads" ON download_logs;
CREATE POLICY "Users can log downloads" ON download_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- search_logs: Users can only insert their own search logs
DROP POLICY IF EXISTS "Users can log searches" ON search_logs;
CREATE POLICY "Users can log searches" ON search_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- view_logs: Users can only insert their own view logs
DROP POLICY IF EXISTS "Users can log views" ON view_logs;
CREATE POLICY "Users can log views" ON view_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- saved_searches: Users can only insert their own saved searches
DROP POLICY IF EXISTS "Users can insert own searches" ON saved_searches;
CREATE POLICY "Users can insert own searches" ON saved_searches
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_approved = true
    )
  );

-- user_favorites: Users can only insert their own favorites
DROP POLICY IF EXISTS "Users can insert own favorites" ON user_favorites;
CREATE POLICY "Users can insert own favorites" ON user_favorites
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_approved = true
    )
  );

-- shared_collections: Users can only create shares as themselves
DROP POLICY IF EXISTS "Approved users can create shares" ON shared_collections;
CREATE POLICY "Approved users can create shares" ON shared_collections
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_approved = true
    )
  );

-- shared_collection_patterns: Users can only add to their own collections
DROP POLICY IF EXISTS "Users can add patterns to own shares" ON shared_collection_patterns;
CREATE POLICY "Users can add patterns to own shares" ON shared_collection_patterns
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM shared_collections sc
    WHERE sc.id = collection_id AND sc.created_by = auth.uid()
  ));

-- ============================================================================
-- 6. Add WITH CHECK to duplicate_reviews ALL policy
-- ============================================================================
DROP POLICY IF EXISTS "Admins can manage duplicate reviews" ON duplicate_reviews;
CREATE POLICY "Admins can manage duplicate reviews" ON duplicate_reviews
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ));

-- ============================================================================
-- 7. Fix Function Search Path Mutable warnings
-- ============================================================================
-- Setting search_path prevents search path injection attacks where an attacker
-- could create malicious functions in a schema earlier in the search path.

ALTER FUNCTION public.search_patterns_semantic SET search_path = public;
ALTER FUNCTION public.get_patterns_by_keywords SET search_path = public;
ALTER FUNCTION public.match_patterns SET search_path = public;
ALTER FUNCTION public.get_share_by_token SET search_path = public;
ALTER FUNCTION public.submit_share_feedback SET search_path = public;
ALTER FUNCTION public.get_share_patterns_by_token SET search_path = public;
ALTER FUNCTION public.find_duplicate_patterns SET search_path = public;
ALTER FUNCTION public.get_keywords_with_counts SET search_path = public;
ALTER FUNCTION public.count_patterns_without_keywords SET search_path = public;
ALTER FUNCTION public.get_patterns_without_keywords SET search_path = public;
ALTER FUNCTION public.merge_keywords SET search_path = public;

-- ============================================================================
-- NOTE: "Extension in Public" warning for vector extension
-- ============================================================================
-- The pgvector extension is installed in the public schema. This is flagged
-- as a warning but is acceptable for self-hosted Supabase. Moving it would
-- require recreating the embedding column and index. Safe to dismiss.

-- ============================================================================
-- Verification queries (run manually to verify)
-- ============================================================================
--
-- Check all tables have RLS policies:
-- SELECT t.tablename, COUNT(p.policyname) as policy_count
-- FROM pg_tables t
-- LEFT JOIN pg_policies p ON t.schemaname = p.schemaname AND t.tablename = p.tablename
-- WHERE t.schemaname = 'public' AND t.rowsecurity = true
-- GROUP BY t.tablename
-- ORDER BY policy_count, t.tablename;
--
-- Check anon permissions:
-- SELECT table_name, privilege_type
-- FROM information_schema.table_privileges
-- WHERE grantee = 'anon' AND table_schema = 'public';
