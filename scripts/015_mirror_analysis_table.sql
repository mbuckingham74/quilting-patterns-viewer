-- Create table for storing mirror analysis results
CREATE TABLE IF NOT EXISTS mirror_analysis (
    id SERIAL PRIMARY KEY,
    pattern_id INTEGER NOT NULL UNIQUE REFERENCES patterns(id) ON DELETE CASCADE,
    is_mirrored BOOLEAN NOT NULL DEFAULT FALSE,
    confidence VARCHAR(10) NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    reason TEXT,
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_at TIMESTAMPTZ
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_mirror_analysis_pattern_id ON mirror_analysis(pattern_id);
CREATE INDEX IF NOT EXISTS idx_mirror_analysis_is_mirrored ON mirror_analysis(is_mirrored) WHERE is_mirrored = TRUE;
CREATE INDEX IF NOT EXISTS idx_mirror_analysis_reviewed ON mirror_analysis(reviewed);

-- Enable RLS
ALTER TABLE mirror_analysis ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON mirror_analysis
    FOR SELECT TO authenticated USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role all" ON mirror_analysis
    FOR ALL TO service_role USING (true) WITH CHECK (true);
