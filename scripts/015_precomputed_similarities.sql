-- Migration: Pre-computed Pattern Similarities
-- Replaces the slow O(n²) self-join with a pre-computed table
-- The table is populated by a background script (compute_similarities.py)

-- Table to store pre-computed similarity scores
-- Only stores pairs above a minimum threshold (0.85) to keep table manageable
CREATE TABLE IF NOT EXISTS pattern_similarities (
  pattern_id_1 INT NOT NULL,
  pattern_id_2 INT NOT NULL,
  similarity REAL NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  -- Store normalized: smaller id in pattern_id_1
  PRIMARY KEY (pattern_id_1, pattern_id_2),
  CONSTRAINT ordered_similarity_pair CHECK (pattern_id_1 < pattern_id_2)
);

-- Index for fast threshold queries
CREATE INDEX IF NOT EXISTS idx_pattern_similarities_score
  ON pattern_similarities (similarity DESC);

-- RLS: Only authenticated users can read (admin check happens in API)
ALTER TABLE pattern_similarities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read similarities" ON pattern_similarities;
CREATE POLICY "Authenticated users can read similarities"
  ON pattern_similarities FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Drop the old slow function
DROP FUNCTION IF EXISTS find_duplicate_patterns(float, int);

-- New fast function that queries pre-computed similarities
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
    ps.pattern_id_1 AS pattern_id,
    ps.pattern_id_2 AS similar_pattern_id,
    ps.similarity::float AS similarity
  FROM pattern_similarities ps
  WHERE ps.similarity >= similarity_threshold
    -- Exclude pairs that have already been reviewed
    AND NOT EXISTS (
      SELECT 1 FROM duplicate_reviews dr
      WHERE dr.pattern_id_1 = ps.pattern_id_1
        AND dr.pattern_id_2 = ps.pattern_id_2
    )
  ORDER BY ps.similarity DESC
  LIMIT max_results;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION find_duplicate_patterns(float, int) TO authenticated;

-- Grant access to the similarities table for authenticated users
GRANT SELECT ON pattern_similarities TO authenticated;
