-- Migration: Add efficient keyword statistics functions
-- These functions push aggregation to the database level for better performance

-- Function to get all keywords with their pattern counts
-- Uses a single query with LEFT JOIN and GROUP BY for efficiency
CREATE OR REPLACE FUNCTION get_keywords_with_counts(
  search_term TEXT DEFAULT '',
  sort_by TEXT DEFAULT 'value',
  sort_order TEXT DEFAULT 'asc'
)
RETURNS TABLE (
  id INTEGER,
  value TEXT,
  pattern_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.value,
    COALESCE(COUNT(pk.pattern_id), 0) AS pattern_count
  FROM keywords k
  LEFT JOIN pattern_keywords pk ON k.id = pk.keyword_id
  WHERE k.value ILIKE '%' || search_term || '%'
  GROUP BY k.id, k.value
  ORDER BY
    CASE WHEN sort_by = 'value' AND sort_order = 'asc' THEN k.value END ASC,
    CASE WHEN sort_by = 'value' AND sort_order = 'desc' THEN k.value END DESC,
    CASE WHEN sort_by = 'count' AND sort_order = 'asc' THEN COUNT(pk.pattern_id) END ASC,
    CASE WHEN sort_by = 'count' AND sort_order = 'desc' THEN COUNT(pk.pattern_id) END DESC,
    k.value ASC;  -- Default fallback
END;
$$;

-- Function to count patterns without any keywords
-- Uses NOT EXISTS for efficiency (stops at first match)
CREATE OR REPLACE FUNCTION count_patterns_without_keywords()
RETURNS BIGINT
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT COUNT(*)
  FROM patterns p
  WHERE p.is_staged = false
    AND NOT EXISTS (
      SELECT 1 FROM pattern_keywords pk WHERE pk.pattern_id = p.id
    );
$$;

-- Function to get patterns without any keywords (paginated)
-- Uses NOT EXISTS for efficiency
CREATE OR REPLACE FUNCTION get_patterns_without_keywords(
  page_limit INTEGER DEFAULT 50,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id INTEGER,
  file_name TEXT,
  notes TEXT,
  author TEXT,
  thumbnail_url TEXT,
  file_extension TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY INVOKER
STABLE
AS $$
  SELECT
    p.id,
    p.file_name,
    p.notes,
    p.author,
    p.thumbnail_url,
    p.file_extension,
    p.created_at
  FROM patterns p
  WHERE p.is_staged = false
    AND NOT EXISTS (
      SELECT 1 FROM pattern_keywords pk WHERE pk.pattern_id = p.id
    )
  ORDER BY p.file_name ASC
  LIMIT page_limit
  OFFSET page_offset;
$$;

-- Function to merge keywords atomically
-- Moves all pattern associations from source to target, then deletes source
-- Uses a transaction to ensure atomicity
CREATE OR REPLACE FUNCTION merge_keywords(
  source_keyword_id INTEGER,
  target_keyword_id INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  source_kw RECORD;
  target_kw RECORD;
  patterns_moved INTEGER := 0;
  patterns_already_had_target INTEGER := 0;
BEGIN
  -- Validate source and target are different
  IF source_keyword_id = target_keyword_id THEN
    RAISE EXCEPTION 'Source and target keywords must be different';
  END IF;

  -- Get source keyword
  SELECT id, value INTO source_kw FROM keywords WHERE id = source_keyword_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source keyword not found';
  END IF;

  -- Get target keyword
  SELECT id, value INTO target_kw FROM keywords WHERE id = target_keyword_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target keyword not found';
  END IF;

  -- Count patterns that already have the target keyword
  SELECT COUNT(*) INTO patterns_already_had_target
  FROM pattern_keywords pk_source
  WHERE pk_source.keyword_id = source_keyword_id
    AND EXISTS (
      SELECT 1 FROM pattern_keywords pk_target
      WHERE pk_target.keyword_id = target_keyword_id
        AND pk_target.pattern_id = pk_source.pattern_id
    );

  -- Insert new associations for patterns that don't already have target keyword
  INSERT INTO pattern_keywords (pattern_id, keyword_id)
  SELECT pk.pattern_id, target_keyword_id
  FROM pattern_keywords pk
  WHERE pk.keyword_id = source_keyword_id
    AND NOT EXISTS (
      SELECT 1 FROM pattern_keywords existing
      WHERE existing.keyword_id = target_keyword_id
        AND existing.pattern_id = pk.pattern_id
    );

  GET DIAGNOSTICS patterns_moved = ROW_COUNT;

  -- Delete all associations for source keyword
  DELETE FROM pattern_keywords WHERE keyword_id = source_keyword_id;

  -- Delete the source keyword
  DELETE FROM keywords WHERE id = source_keyword_id;

  -- Return result as JSON
  RETURN json_build_object(
    'success', true,
    'source', json_build_object('id', source_kw.id, 'value', source_kw.value),
    'target', json_build_object('id', target_kw.id, 'value', target_kw.value),
    'patterns_moved', patterns_moved,
    'patterns_already_had_target', patterns_already_had_target
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_keywords_with_counts(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION count_patterns_without_keywords() TO authenticated;
GRANT EXECUTE ON FUNCTION get_patterns_without_keywords(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION merge_keywords(INTEGER, INTEGER) TO authenticated;
