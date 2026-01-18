-- Migration: Add HNSW index for fast vector similarity search
-- This will dramatically improve AI semantic search performance
--
-- Background: The slow query analysis showed search_patterns_semantic averaging
-- 724ms with max times over 5 seconds - indicating full table scans without
-- a proper vector index.
--
-- Run this in Supabase SQL Editor
--
-- APPLIED: January 18, 2026
-- RESULTS: Query time reduced from 724ms to ~2-3ms

-- =====================================================
-- STEP 1: Optimize planner settings for SSD storage
-- =====================================================

-- random_page_cost: Default 4 is for spinning disks
-- 1.1 is appropriate for SSDs and makes index scans more attractive
ALTER DATABASE postgres SET random_page_cost = 1.1;

-- effective_cache_size: Helps planner estimate cache hits
-- Set to ~75% of available RAM (1GB is conservative)
ALTER DATABASE postgres SET effective_cache_size = '1GB';

-- =====================================================
-- STEP 2: Create HNSW vector index
-- =====================================================

-- Drop any existing vector indexes
DROP INDEX IF EXISTS patterns_embedding_idx;  -- old IVFFlat index
DROP INDEX IF EXISTS idx_patterns_embedding;
DROP INDEX IF EXISTS idx_patterns_embedding_hnsw;

-- Create HNSW index (preferred for datasets under 1M rows)
-- Parameters:
--   m = 16: max connections per node (higher = more accurate, more memory)
--   ef_construction = 64: build-time search depth (higher = better index, slower build)
--
-- For ~15k patterns, this should build in seconds
CREATE INDEX idx_patterns_embedding_hnsw
  ON patterns
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- =====================================================
-- STEP 3: Recreate search function
-- =====================================================

-- Drop existing function first (return type may differ)
DROP FUNCTION IF EXISTS search_patterns_semantic(vector, double precision, integer);

-- Recreate with search_path set for security (from migration 012)
CREATE OR REPLACE FUNCTION search_patterns_semantic(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 50
)
RETURNS TABLE (
  id int,
  file_name text,
  file_extension text,
  author text,
  thumbnail_url text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    p.id,
    p.file_name,
    p.file_extension,
    p.author,
    p.thumbnail_url,
    (1 - (p.embedding <=> query_embedding))::float AS similarity
  FROM patterns p
  WHERE p.embedding IS NOT NULL
    AND (1 - (p.embedding <=> query_embedding)) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant permissions (anon removed per security hardening)
GRANT EXECUTE ON FUNCTION search_patterns_semantic TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================

-- After running, verify the index exists:
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'patterns' AND indexname LIKE '%embedding%';

-- Test query performance (should be <10ms now):
-- EXPLAIN ANALYZE SELECT * FROM search_patterns_semantic(
--   (SELECT embedding FROM patterns WHERE embedding IS NOT NULL LIMIT 1),
--   0.2,
--   50
-- );
