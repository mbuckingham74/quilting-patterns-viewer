-- Migration: Duplicate Detection Feature
-- Adds table to track reviewed duplicate pairs and RPC function to find duplicates

-- Table to track reviewed duplicate pairs
-- We normalize pairs by storing smaller ID in pattern_id_1, larger in pattern_id_2
CREATE TABLE IF NOT EXISTS duplicate_reviews (
  id SERIAL PRIMARY KEY,
  pattern_id_1 INT NOT NULL,
  pattern_id_2 INT NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  decision TEXT NOT NULL CHECK (decision IN ('keep_both', 'deleted_first', 'deleted_second')),
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure no duplicate reviews for same pair (pairs are stored normalized: smaller id first)
  CONSTRAINT unique_pair UNIQUE (pattern_id_1, pattern_id_2),
  -- Ensure pattern_id_1 < pattern_id_2 (normalized storage)
  CONSTRAINT ordered_pair CHECK (pattern_id_1 < pattern_id_2)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_duplicate_reviews_pair
  ON duplicate_reviews (pattern_id_1, pattern_id_2);

-- RLS: Only admins can access duplicate reviews
ALTER TABLE duplicate_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage duplicate reviews" ON duplicate_reviews;
CREATE POLICY "Admins can manage duplicate reviews"
  ON duplicate_reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- RPC function to find duplicate pattern pairs
-- Returns pairs with similarity above threshold, excluding already-reviewed pairs
-- Orders by similarity (highest first)
CREATE OR REPLACE FUNCTION find_duplicate_patterns(
  similarity_threshold float DEFAULT 0.95,
  max_results int DEFAULT 50
)
RETURNS TABLE (
  pattern_id int,
  similar_pattern_id int,
  similarity float
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    p1.id AS pattern_id,
    p2.id AS similar_pattern_id,
    1 - (p1.embedding <=> p2.embedding) AS similarity
  FROM patterns p1
  INNER JOIN patterns p2 ON p1.id < p2.id
  WHERE p1.embedding IS NOT NULL
    AND p2.embedding IS NOT NULL
    AND 1 - (p1.embedding <=> p2.embedding) > similarity_threshold
    -- Exclude pairs that have already been reviewed
    -- (duplicate_reviews stores pairs normalized: smaller id in pattern_id_1)
    AND NOT EXISTS (
      SELECT 1 FROM duplicate_reviews dr
      WHERE dr.pattern_id_1 = p1.id
        AND dr.pattern_id_2 = p2.id
    )
  ORDER BY (p1.embedding <=> p2.embedding) ASC
  LIMIT max_results;
$$;

-- Grant execute permission to authenticated users (RLS will still apply)
GRANT EXECUTE ON FUNCTION find_duplicate_patterns(float, int) TO authenticated;
