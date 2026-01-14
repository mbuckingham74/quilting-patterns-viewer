-- Migration: Fix patterns RLS approval gate regression
--
-- Issue: Migration 018_staged_uploads.sql replaced the approval-gated policy
-- with one that only checks auth.role() = 'authenticated', allowing unapproved
-- users to view patterns.
--
-- Fix: Restore the is_approved check while preserving staged pattern logic.

-- Drop the regressed policy
DROP POLICY IF EXISTS "Patterns are viewable by authenticated users" ON patterns;

-- Also drop the old policy name in case it exists
DROP POLICY IF EXISTS "Patterns viewable by approved users" ON patterns;

-- Create corrected policy: approved users see non-staged, admins see all
CREATE POLICY "Patterns viewable by approved users" ON patterns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.is_approved = true
    )
    AND (
      is_staged = false
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.is_admin = true
      )
    )
  );
