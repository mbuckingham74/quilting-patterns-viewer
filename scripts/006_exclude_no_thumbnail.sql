-- Migration: Update keyword filter function to exclude patterns without thumbnails
-- Unless the "No Thumbnail" keyword (ID 616) is explicitly selected
--
-- Run this in Supabase SQL Editor

-- Drop existing function
DROP FUNCTION IF EXISTS get_patterns_by_keywords(integer[], integer, integer, text);

-- Create updated function
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_patterns_by_keywords TO authenticated;
GRANT EXECUTE ON FUNCTION get_patterns_by_keywords TO anon;
