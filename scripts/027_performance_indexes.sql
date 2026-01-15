-- Migration: Add performance indexes and RPC functions
-- Run this in Supabase SQL Editor

-- =====================================================
-- ADDITIONAL INDEXES FOR QUERY PERFORMANCE
-- =====================================================

-- Index for patterns WITH embeddings (used by semantic search to quickly find searchable patterns)
CREATE INDEX IF NOT EXISTS idx_patterns_embedding_not_null
  ON patterns(id)
  WHERE embedding IS NOT NULL;

-- Composite index for analytics time-series queries
CREATE INDEX IF NOT EXISTS idx_download_logs_user_date
  ON download_logs(user_id, downloaded_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_logs_user_date
  ON search_logs(user_id, searched_at DESC);

-- Index for view_logs if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'view_logs') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_view_logs_pattern_date ON view_logs(pattern_id, viewed_at DESC)';
  END IF;
END $$;

-- Index for orientation_analysis pattern lookups
CREATE INDEX IF NOT EXISTS idx_orientation_analysis_pattern_id
  ON orientation_analysis(pattern_id);

-- Partial index for unreviewed mirror analysis (more selective)
DROP INDEX IF EXISTS idx_mirror_analysis_reviewed;
CREATE INDEX IF NOT EXISTS idx_mirror_analysis_unreviewed
  ON mirror_analysis(reviewed)
  WHERE reviewed = FALSE;

-- Index for admin_activity_log queries
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_date
  ON admin_activity_log(admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_type
  ON admin_activity_log(action_type, target_type);

-- =====================================================
-- RPC FUNCTION: Get top downloaded patterns with SQL aggregation
-- Much more efficient than loading all logs into memory
-- =====================================================

CREATE OR REPLACE FUNCTION get_top_downloaded_patterns(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  pattern_id INT,
  file_name TEXT,
  thumbnail_url TEXT,
  author TEXT,
  download_count BIGINT,
  favorite_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH download_counts AS (
    SELECT
      dl.pattern_id,
      COUNT(*) as download_count
    FROM download_logs dl
    GROUP BY dl.pattern_id
    ORDER BY download_count DESC
    LIMIT p_limit
  ),
  favorite_counts AS (
    SELECT
      uf.pattern_id,
      COUNT(*) as favorite_count
    FROM user_favorites uf
    WHERE uf.pattern_id IN (SELECT pattern_id FROM download_counts)
    GROUP BY uf.pattern_id
  )
  SELECT
    p.id as pattern_id,
    p.file_name,
    p.thumbnail_url,
    p.author,
    COALESCE(dc.download_count, 0) as download_count,
    COALESCE(fc.favorite_count, 0) as favorite_count
  FROM patterns p
  INNER JOIN download_counts dc ON p.id = dc.pattern_id
  LEFT JOIN favorite_counts fc ON p.id = fc.pattern_id
  ORDER BY dc.download_count DESC;
$$;

-- Grant execute to authenticated users (admin check done in API)
GRANT EXECUTE ON FUNCTION get_top_downloaded_patterns(INT) TO authenticated;

-- =====================================================
-- RPC FUNCTION: Get top viewed patterns
-- =====================================================

CREATE OR REPLACE FUNCTION get_top_viewed_patterns(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  pattern_id INT,
  file_name TEXT,
  thumbnail_url TEXT,
  author TEXT,
  view_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id as pattern_id,
    p.file_name,
    p.thumbnail_url,
    p.author,
    COUNT(vl.id) as view_count
  FROM patterns p
  LEFT JOIN view_logs vl ON p.id = vl.pattern_id
  GROUP BY p.id, p.file_name, p.thumbnail_url, p.author
  HAVING COUNT(vl.id) > 0
  ORDER BY view_count DESC
  LIMIT p_limit;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_top_viewed_patterns(INT) TO authenticated;

-- =====================================================
-- RPC FUNCTION: Get top searches
-- =====================================================

CREATE OR REPLACE FUNCTION get_top_searches(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  query TEXT,
  search_count BIGINT,
  avg_results NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    LOWER(TRIM(sl.query)) as query,
    COUNT(*) as search_count,
    ROUND(AVG(sl.result_count), 1) as avg_results
  FROM search_logs sl
  WHERE sl.query IS NOT NULL AND LENGTH(TRIM(sl.query)) > 0
  GROUP BY LOWER(TRIM(sl.query))
  ORDER BY search_count DESC
  LIMIT p_limit;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_top_searches(INT) TO authenticated;
