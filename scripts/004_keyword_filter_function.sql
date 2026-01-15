-- ============================================================
-- DEPRECATED: DO NOT RE-RUN THIS SCRIPT
-- This script has been superseded by 024_fix_legacy_rpc_security.sql
-- Re-running this will reintroduce security vulnerabilities:
--   - SECURITY DEFINER bypasses RLS policies
--   - GRANT TO anon allows unauthenticated access
-- ============================================================
--
-- Migration: Add RPC function for keyword filtering
-- This avoids the 414 URI Too Large error when filtering by keywords with many matches
--
-- Run this in Supabase SQL Editor

-- Drop if exists for idempotency
DROP FUNCTION IF EXISTS get_patterns_by_keywords(integer[], integer, integer, text);

-- Create function to get patterns filtered by keyword IDs
CREATE OR REPLACE FUNCTION get_patterns_by_keywords(
  keyword_ids integer[],
  page_offset integer DEFAULT 0,
  page_limit integer DEFAULT 50,
  search_term text DEFAULT NULL
)
RETURNS TABLE (
  id integer,
  file_name text,
  file_extension text,
  file_size integer,
  author text,
  author_url text,
  author_notes text,
  notes text,
  thumbnail_url text,
  pattern_file_url text,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH filtered_patterns AS (
    SELECT DISTINCT p.*
    FROM patterns p
    INNER JOIN pattern_keywords pk ON p.id = pk.pattern_id
    WHERE pk.keyword_id = ANY(keyword_ids)
      AND (search_term IS NULL OR (
        p.file_name ILIKE '%' || search_term || '%' OR
        p.author ILIKE '%' || search_term || '%' OR
        p.notes ILIKE '%' || search_term || '%'
      ))
  ),
  counted AS (
    SELECT COUNT(*) as cnt FROM filtered_patterns
  )
  SELECT
    fp.id,
    fp.file_name,
    fp.file_extension,
    fp.file_size,
    fp.author,
    fp.author_url,
    fp.author_notes,
    fp.notes,
    fp.thumbnail_url,
    fp.pattern_file_url,
    fp.created_at,
    c.cnt as total_count
  FROM filtered_patterns fp
  CROSS JOIN counted c
  ORDER BY fp.file_name ASC NULLS LAST
  OFFSET page_offset
  LIMIT page_limit;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_patterns_by_keywords TO authenticated;
GRANT EXECUTE ON FUNCTION get_patterns_by_keywords TO anon;
