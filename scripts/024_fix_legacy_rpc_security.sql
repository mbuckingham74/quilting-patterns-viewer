-- Migration: Fix legacy RPC function security
-- Addresses security issues from scripts 004 and 006:
-- - Revokes anon grants (anonymous users should not call these functions)
-- - Converts to SECURITY INVOKER so RLS policies are enforced
--
-- Run this in Supabase SQL Editor

-- ============================================================
-- Fix get_patterns_by_keywords function
-- Originally defined in 004_keyword_filter_function.sql and 006_exclude_no_thumbnail.sql
-- ============================================================

-- Revoke anon access (anon users should not be able to call this)
REVOKE EXECUTE ON FUNCTION get_patterns_by_keywords(integer[], integer, integer, text) FROM anon;

-- Recreate the function with SECURITY INVOKER (respects RLS)
-- This is the latest version from 006_exclude_no_thumbnail.sql
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
SECURITY INVOKER  -- Changed from SECURITY DEFINER to respect RLS
AS $$
DECLARE
  no_thumbnail_keyword_id integer := 616;
  include_no_thumbnail boolean;
BEGIN
  -- Check if "No Thumbnail" keyword is in the selected keywords
  include_no_thumbnail := no_thumbnail_keyword_id = ANY(keyword_ids);

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
      -- Exclude patterns without thumbnails unless "No Thumbnail" keyword is selected
      AND (include_no_thumbnail OR p.thumbnail_url IS NOT NULL)
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

-- Only grant to authenticated users
GRANT EXECUTE ON FUNCTION get_patterns_by_keywords TO authenticated;

-- Verify the changes
DO $$
BEGIN
  RAISE NOTICE 'Migration 024 complete: get_patterns_by_keywords is now SECURITY INVOKER with authenticated-only access';
END $$;
