-- Create table to store AI orientation analysis results
CREATE TABLE IF NOT EXISTS orientation_analysis (
  id SERIAL PRIMARY KEY,
  pattern_id INTEGER NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
  orientation TEXT NOT NULL CHECK (orientation IN ('correct', 'rotate_90_cw', 'rotate_90_ccw', 'rotate_180')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  reason TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  UNIQUE(pattern_id)
);

-- Index for finding patterns that need rotation
CREATE INDEX idx_orientation_needs_rotation ON orientation_analysis(orientation) WHERE orientation != 'correct';

-- Index for finding unreviewed patterns
CREATE INDEX idx_orientation_unreviewed ON orientation_analysis(reviewed) WHERE reviewed = FALSE;

-- RLS policies
ALTER TABLE orientation_analysis ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Authenticated users can read orientation analysis"
  ON orientation_analysis FOR SELECT
  TO authenticated
  USING (true);

-- Allow service role to manage
CREATE POLICY "Service role can manage orientation analysis"
  ON orientation_analysis FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
