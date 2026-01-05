-- Migration: Fix SECURITY DEFINER RLS Bypass Vulnerability
--
-- SECURITY FIX: The get_patterns_by_keywords function used SECURITY DEFINER
-- and was executable by anon, completely bypassing RLS.
--
-- Problem: SECURITY DEFINER functions run with the owner's privileges,
-- allowing unauthenticated users to query all pattern data.
--
-- Solution:
-- 1. Change to SECURITY INVOKER (respects caller's RLS)
-- 2. Revoke anon execute permission
-- 3. Add explicit approval check inside function as defense-in-depth

-- Drop existing function
DROP FUNCTION IF EXISTS get_patterns_by_keywords(integer[], integer, integer, text);

-- Recreate with SECURITY INVOKER (default, but explicit for clarity)
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
SECURITY INVOKER  -- Respects caller's RLS policies
STABLE            -- Function doesn't modify data
AS $$
DECLARE
  no_thumbnail_keyword_id integer := 616;
  include_no_thumbnail boolean;
BEGIN
  -- Defense in depth: verify caller is approved
  -- (RLS should catch this, but belt-and-suspenders)
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.is_approved = true
  ) THEN
    RAISE EXCEPTION 'Access denied: user not approved';
  END IF;

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

-- Only grant execute to authenticated users (not anon)
REVOKE ALL ON FUNCTION get_patterns_by_keywords FROM PUBLIC;
REVOKE ALL ON FUNCTION get_patterns_by_keywords FROM anon;
GRANT EXECUTE ON FUNCTION get_patterns_by_keywords TO authenticated;

-- Also fix any other SECURITY DEFINER functions that might have similar issues
-- Check match_patterns (semantic search function)

-- First, let's see if it exists and fix it too
DROP FUNCTION IF EXISTS match_patterns(vector(1024), float, int);

CREATE OR REPLACE FUNCTION match_patterns(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 50
)
RETURNS TABLE (
  id int,
  file_name text,
  thumbnail_url text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY INVOKER  -- Respects caller's RLS
AS $$
  SELECT
    patterns.id,
    patterns.file_name,
    patterns.thumbnail_url,
    1 - (patterns.embedding <=> query_embedding) AS similarity
  FROM patterns
  WHERE 1 - (patterns.embedding <=> query_embedding) > match_threshold
  ORDER BY patterns.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Only grant to authenticated users
REVOKE ALL ON FUNCTION match_patterns FROM PUBLIC;
REVOKE ALL ON FUNCTION match_patterns FROM anon;
GRANT EXECUTE ON FUNCTION match_patterns TO authenticated;
