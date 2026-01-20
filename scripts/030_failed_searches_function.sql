-- Migration: Add function to get aggregated failed searches
-- This performs GROUP BY in the database instead of loading all rows into memory

CREATE OR REPLACE FUNCTION get_failed_searches(
  days_ago INTEGER DEFAULT 90,
  result_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  query TEXT,
  count BIGINT,
  last_searched TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    LOWER(TRIM(sl.query)) as query,
    COUNT(*) as count,
    MAX(sl.searched_at) as last_searched
  FROM search_logs sl
  WHERE sl.result_count = 0
    AND sl.searched_at >= (NOW() - (days_ago || ' days')::INTERVAL)
  GROUP BY LOWER(TRIM(sl.query))
  ORDER BY count DESC, last_searched DESC
  LIMIT result_limit;
$$;

-- Also get total count of failed searches in the time window
CREATE OR REPLACE FUNCTION count_failed_searches(days_ago INTEGER DEFAULT 90)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM search_logs
  WHERE result_count = 0
    AND searched_at >= (NOW() - (days_ago || ' days')::INTERVAL);
$$;

-- Grant execute to authenticated users (admin check happens in application)
GRANT EXECUTE ON FUNCTION get_failed_searches(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION count_failed_searches(INTEGER) TO authenticated;

-- Add index to optimize the failed searches query
CREATE INDEX IF NOT EXISTS idx_search_logs_failed_recent
  ON search_logs (searched_at DESC)
  WHERE result_count = 0;
