-- Migration: Add sequence for pattern IDs to prevent race conditions
-- Run this in Supabase SQL Editor
--
-- This migration is IDEMPOTENT - safe to run multiple times.
--
-- Problem: Both API and Python script use max(id)+1 for new patterns.
-- With concurrent uploads, two processes can get the same ID and collide.
-- The upsert behavior means one pattern silently overwrites another.
--
-- Solution: Use a PostgreSQL sequence to atomically assign IDs.

-- ============================================
-- 1. CREATE SEQUENCE (if not exists)
-- ============================================

-- Create sequence starting after the current max ID
DO $$
DECLARE
  max_id INTEGER;
BEGIN
  -- Get current max ID
  SELECT COALESCE(MAX(id), 0) INTO max_id FROM patterns;

  -- Create sequence if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'patterns_id_seq') THEN
    EXECUTE format('CREATE SEQUENCE patterns_id_seq START WITH %s', max_id + 1);
    RAISE NOTICE 'Created sequence patterns_id_seq starting at %', max_id + 1;
  ELSE
    -- Update sequence to be at least max_id + 1
    EXECUTE format('SELECT setval(''patterns_id_seq'', GREATEST(nextval(''patterns_id_seq'') - 1, %s))', max_id);
    RAISE NOTICE 'Sequence patterns_id_seq already exists, ensured it is past %', max_id;
  END IF;
END $$;

-- ============================================
-- 2. ALTER COLUMN TO USE SEQUENCE (if not already)
-- ============================================

-- Set default for id column to use sequence
-- This allows INSERT without specifying id
ALTER TABLE patterns ALTER COLUMN id SET DEFAULT nextval('patterns_id_seq');

-- ============================================
-- 3. CREATE HELPER FUNCTION FOR NEXT ID
-- ============================================

-- Function to get next pattern ID (for cases where we need ID before insert)
-- Uses SECURITY DEFINER so authenticated users can call it without needing
-- direct USAGE permission on the sequence
CREATE OR REPLACE FUNCTION get_next_pattern_id()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('patterns_id_seq')::INTEGER;
$$;

-- Revoke default PUBLIC access, then grant only to authenticated users
REVOKE EXECUTE ON FUNCTION get_next_pattern_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_next_pattern_id() TO authenticated;

-- ============================================
-- Done! Pattern IDs are now safely assigned by sequence.
-- ============================================
