-- Migration: Secure analytics RPC functions
--
-- Issue: The analytics RPCs (get_top_downloaded_patterns, get_top_viewed_patterns,
-- get_top_searches) use SECURITY DEFINER without admin checks, allowing any
-- authenticated user to bypass RLS and access aggregated analytics data.
--
-- Fix: Add is_admin check inside functions, SET search_path, and restrict grants.
-- Non-admins get empty results to avoid leaking admin status.

-- =====================================================
-- SECURE RPC: Get top downloaded patterns (admin only)
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
SET search_path = public
AS $$
  WITH download_counts AS (
    SELECT
      dl.pattern_id,
      COUNT(*) as download_count
    FROM download_logs dl
    -- Only execute if caller is admin
    WHERE EXISTS (
      SELECT 1 FROM profiles caller
      WHERE caller.id = auth.uid()
      AND caller.is_admin = true
    )
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

-- Revoke from public/anon, only grant to authenticated
REVOKE ALL ON FUNCTION get_top_downloaded_patterns(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_top_downloaded_patterns(INT) FROM anon;
GRANT EXECUTE ON FUNCTION get_top_downloaded_patterns(INT) TO authenticated;

-- =====================================================
-- SECURE RPC: Get top viewed patterns (admin only)
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
SET search_path = public
AS $$
  SELECT
    p.id as pattern_id,
    p.file_name,
    p.thumbnail_url,
    p.author,
    COUNT(vl.id) as view_count
  FROM patterns p
  LEFT JOIN view_logs vl ON p.id = vl.pattern_id
  -- Only execute if caller is admin
  WHERE EXISTS (
    SELECT 1 FROM profiles caller
    WHERE caller.id = auth.uid()
    AND caller.is_admin = true
  )
  GROUP BY p.id, p.file_name, p.thumbnail_url, p.author
  HAVING COUNT(vl.id) > 0
  ORDER BY view_count DESC
  LIMIT p_limit;
$$;

-- Revoke from public/anon, only grant to authenticated
REVOKE ALL ON FUNCTION get_top_viewed_patterns(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_top_viewed_patterns(INT) FROM anon;
GRANT EXECUTE ON FUNCTION get_top_viewed_patterns(INT) TO authenticated;

-- =====================================================
-- SECURE RPC: Get top searches (admin only)
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
SET search_path = public
AS $$
  SELECT
    LOWER(TRIM(sl.query)) as query,
    COUNT(*) as search_count,
    ROUND(AVG(sl.result_count), 1) as avg_results
  FROM search_logs sl
  WHERE sl.query IS NOT NULL
    AND LENGTH(TRIM(sl.query)) > 0
    -- Only execute if caller is admin
    AND EXISTS (
      SELECT 1 FROM profiles caller
      WHERE caller.id = auth.uid()
      AND caller.is_admin = true
    )
  GROUP BY LOWER(TRIM(sl.query))
  ORDER BY search_count DESC
  LIMIT p_limit;
$$;

-- Revoke from public/anon, only grant to authenticated
REVOKE ALL ON FUNCTION get_top_searches(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_top_searches(INT) FROM anon;
GRANT EXECUTE ON FUNCTION get_top_searches(INT) TO authenticated;
