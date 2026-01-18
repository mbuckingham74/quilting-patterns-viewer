-- Migration: Triage Queue Functions
-- Creates functions to aggregate patterns needing attention from multiple sources
-- (rotation issues, mirror issues, missing keywords)

-- Function to get patterns in the triage queue with all their issues
CREATE OR REPLACE FUNCTION get_triage_queue(
  filter_type TEXT DEFAULT 'all',  -- 'all', 'rotation', 'mirror', 'no_keywords'
  page_limit INTEGER DEFAULT 50,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  pattern_id INTEGER,
  file_name TEXT,
  thumbnail_url TEXT,
  author TEXT,
  file_extension TEXT,
  issue_types TEXT[],
  issue_details JSONB,
  priority_score INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH pattern_issues AS (
    -- Rotation issues (orientation != 'correct' and not reviewed)
    SELECT
      p.id AS pid,
      p.file_name AS p_file_name,
      p.thumbnail_url AS p_thumbnail_url,
      p.author AS p_author,
      p.file_extension AS p_file_extension,
      'rotation'::TEXT AS issue_type,
      jsonb_build_object(
        'orientation', oa.orientation,
        'confidence', oa.confidence,
        'reason', oa.reason
      ) AS details,
      CASE oa.confidence
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        ELSE 1
      END AS priority
    FROM patterns p
    INNER JOIN orientation_analysis oa ON p.id = oa.pattern_id
    WHERE oa.orientation != 'correct'
      AND oa.reviewed = false
      AND p.is_staged = false
      AND (filter_type = 'all' OR filter_type = 'rotation')

    UNION ALL

    -- Mirror issues (is_mirrored = true and not reviewed)
    SELECT
      p.id,
      p.file_name,
      p.thumbnail_url,
      p.author,
      p.file_extension,
      'mirror'::TEXT,
      jsonb_build_object(
        'confidence', ma.confidence,
        'reason', ma.reason
      ),
      CASE ma.confidence
        WHEN 'high' THEN 3
        WHEN 'medium' THEN 2
        ELSE 1
      END
    FROM patterns p
    INNER JOIN mirror_analysis ma ON p.id = ma.pattern_id
    WHERE ma.is_mirrored = true
      AND ma.reviewed = false
      AND p.is_staged = false
      AND (filter_type = 'all' OR filter_type = 'mirror')

    UNION ALL

    -- Missing keywords
    SELECT
      p.id,
      p.file_name,
      p.thumbnail_url,
      p.author,
      p.file_extension,
      'no_keywords'::TEXT,
      '{}'::jsonb,
      1  -- Low priority for missing keywords
    FROM patterns p
    WHERE p.is_staged = false
      AND NOT EXISTS (
        SELECT 1 FROM pattern_keywords pk WHERE pk.pattern_id = p.id
      )
      AND (filter_type = 'all' OR filter_type = 'no_keywords')
  ),
  aggregated AS (
    SELECT
      pi.pid AS agg_pattern_id,
      MIN(pi.p_file_name) AS agg_file_name,
      MIN(pi.p_thumbnail_url) AS agg_thumbnail_url,
      MIN(pi.p_author) AS agg_author,
      MIN(pi.p_file_extension) AS agg_file_extension,
      array_agg(DISTINCT pi.issue_type ORDER BY pi.issue_type) AS agg_issue_types,
      jsonb_object_agg(pi.issue_type, pi.details) AS agg_issue_details,
      SUM(pi.priority)::INTEGER AS agg_priority_score
    FROM pattern_issues pi
    GROUP BY pi.pid
  )
  SELECT
    a.agg_pattern_id,
    a.agg_file_name,
    a.agg_thumbnail_url,
    a.agg_author,
    a.agg_file_extension,
    a.agg_issue_types,
    a.agg_issue_details,
    a.agg_priority_score
  FROM aggregated a
  ORDER BY a.agg_priority_score DESC, a.agg_pattern_id ASC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

-- Function to count patterns in the triage queue (for pagination and stats)
CREATE OR REPLACE FUNCTION count_triage_queue(
  filter_type TEXT DEFAULT 'all'
)
RETURNS TABLE (
  total BIGINT,
  rotation_count BIGINT,
  mirror_count BIGINT,
  no_keywords_count BIGINT
)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  WITH counts AS (
    -- Count rotation issues
    SELECT 'rotation' AS issue_type, COUNT(DISTINCT oa.pattern_id) AS cnt
    FROM orientation_analysis oa
    INNER JOIN patterns p ON oa.pattern_id = p.id
    WHERE oa.orientation != 'correct'
      AND oa.reviewed = false
      AND p.is_staged = false

    UNION ALL

    -- Count mirror issues
    SELECT 'mirror', COUNT(DISTINCT ma.pattern_id)
    FROM mirror_analysis ma
    INNER JOIN patterns p ON ma.pattern_id = p.id
    WHERE ma.is_mirrored = true
      AND ma.reviewed = false
      AND p.is_staged = false

    UNION ALL

    -- Count patterns without keywords
    SELECT 'no_keywords', COUNT(*)
    FROM patterns p
    WHERE p.is_staged = false
      AND NOT EXISTS (
        SELECT 1 FROM pattern_keywords pk WHERE pk.pattern_id = p.id
      )
  ),
  -- Get unique pattern count for 'all' filter
  all_patterns AS (
    SELECT COUNT(DISTINCT pattern_id) AS total_unique
    FROM (
      SELECT oa.pattern_id
      FROM orientation_analysis oa
      INNER JOIN patterns p ON oa.pattern_id = p.id
      WHERE oa.orientation != 'correct' AND oa.reviewed = false AND p.is_staged = false

      UNION

      SELECT ma.pattern_id
      FROM mirror_analysis ma
      INNER JOIN patterns p ON ma.pattern_id = p.id
      WHERE ma.is_mirrored = true AND ma.reviewed = false AND p.is_staged = false

      UNION

      SELECT p.id
      FROM patterns p
      WHERE p.is_staged = false
        AND NOT EXISTS (SELECT 1 FROM pattern_keywords pk WHERE pk.pattern_id = p.id)
    ) all_issues
  )
  SELECT
    (SELECT total_unique FROM all_patterns) AS total,
    COALESCE((SELECT cnt FROM counts WHERE issue_type = 'rotation'), 0) AS rotation_count,
    COALESCE((SELECT cnt FROM counts WHERE issue_type = 'mirror'), 0) AS mirror_count,
    COALESCE((SELECT cnt FROM counts WHERE issue_type = 'no_keywords'), 0) AS no_keywords_count;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_triage_queue(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION count_triage_queue(TEXT) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION get_triage_queue IS 'Returns patterns needing attention (rotation, mirror, missing keywords) with aggregated issues and priority scores';
COMMENT ON FUNCTION count_triage_queue IS 'Returns counts of patterns needing attention by issue type';
