-- Migration: Query Embedding Cache
-- Description: Cache Voyage AI query embeddings to reduce API calls and latency
-- Date: 2026-01-24

-- Enable pgvector if not already enabled (should already exist from pattern embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create the query embedding cache table
CREATE TABLE IF NOT EXISTS query_embedding_cache (
  id SERIAL PRIMARY KEY,
  -- Normalized query text (lowercase, trimmed)
  query_text TEXT NOT NULL UNIQUE,
  -- The 1024-dimensional embedding from Voyage AI
  embedding vector(1024) NOT NULL,
  -- Track usage for analytics and cache management
  hit_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast query lookup
CREATE INDEX IF NOT EXISTS idx_query_cache_text
  ON query_embedding_cache(query_text);

-- Index for cache cleanup (find stale entries)
CREATE INDEX IF NOT EXISTS idx_query_cache_last_used
  ON query_embedding_cache(last_used_at);

-- RLS: Only allow access through service role (internal API use only)
ALTER TABLE query_embedding_cache ENABLE ROW LEVEL SECURITY;

-- No policies = no direct access from clients
-- All access goes through the service role in API routes

-- Function to get cached embedding (returns NULL if not found)
CREATE OR REPLACE FUNCTION get_cached_query_embedding(p_query_text TEXT)
RETURNS vector(1024)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_embedding vector(1024);
BEGIN
  -- Try to get the cached embedding and update hit count + last_used
  UPDATE query_embedding_cache
  SET
    hit_count = hit_count + 1,
    last_used_at = NOW()
  WHERE query_text = LOWER(TRIM(p_query_text))
  RETURNING embedding INTO v_embedding;

  RETURN v_embedding;
END;
$$;

-- Function to cache a new query embedding
CREATE OR REPLACE FUNCTION cache_query_embedding(
  p_query_text TEXT,
  p_embedding vector(1024)
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update (upsert) the embedding
  INSERT INTO query_embedding_cache (query_text, embedding, hit_count, last_used_at)
  VALUES (LOWER(TRIM(p_query_text)), p_embedding, 1, NOW())
  ON CONFLICT (query_text)
  DO UPDATE SET
    embedding = EXCLUDED.embedding,
    hit_count = query_embedding_cache.hit_count + 1,
    last_used_at = NOW();
END;
$$;

-- Function to clean up stale cache entries (entries not used in X days)
-- Call this periodically via cron or manually
CREATE OR REPLACE FUNCTION cleanup_query_embedding_cache(p_days_old INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM query_embedding_cache
  WHERE last_used_at < NOW() - (p_days_old || ' days')::INTERVAL;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Function to get cache statistics
CREATE OR REPLACE FUNCTION get_query_cache_stats()
RETURNS TABLE (
  total_entries INTEGER,
  total_hits BIGINT,
  oldest_entry TIMESTAMPTZ,
  newest_entry TIMESTAMPTZ,
  avg_hits_per_query NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::INTEGER as total_entries,
    COALESCE(SUM(hit_count), 0) as total_hits,
    MIN(created_at) as oldest_entry,
    MAX(created_at) as newest_entry,
    COALESCE(AVG(hit_count), 0) as avg_hits_per_query
  FROM query_embedding_cache;
$$;

-- Grant execute permissions on functions to authenticated users
-- (functions use SECURITY DEFINER so they run with elevated privileges)
GRANT EXECUTE ON FUNCTION get_cached_query_embedding(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cache_query_embedding(TEXT, vector(1024)) TO authenticated;
GRANT EXECUTE ON FUNCTION get_query_cache_stats() TO authenticated;

-- Only service role should run cleanup
GRANT EXECUTE ON FUNCTION cleanup_query_embedding_cache(INTEGER) TO service_role;

COMMENT ON TABLE query_embedding_cache IS
  'Caches Voyage AI query embeddings to reduce API calls and improve search latency';
COMMENT ON FUNCTION get_cached_query_embedding IS
  'Retrieves cached embedding for a query, updates hit count and last_used timestamp';
COMMENT ON FUNCTION cache_query_embedding IS
  'Stores a query embedding in the cache (upserts if already exists)';
COMMENT ON FUNCTION cleanup_query_embedding_cache IS
  'Removes cache entries not used in the specified number of days (default 30)';
COMMENT ON FUNCTION get_query_cache_stats IS
  'Returns statistics about the query embedding cache';
