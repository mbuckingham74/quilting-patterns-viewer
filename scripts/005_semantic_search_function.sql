-- Semantic search function using pgvector
-- Run this in Supabase SQL Editor after enabling pgvector

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
AS $$
  SELECT
    patterns.id,
    patterns.file_name,
    patterns.file_extension,
    patterns.author,
    patterns.thumbnail_url,
    1 - (patterns.embedding <=> query_embedding) AS similarity
  FROM patterns
  WHERE
    patterns.embedding IS NOT NULL
    AND 1 - (patterns.embedding <=> query_embedding) > match_threshold
  ORDER BY patterns.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_patterns_semantic TO authenticated;
GRANT EXECUTE ON FUNCTION search_patterns_semantic TO anon;
