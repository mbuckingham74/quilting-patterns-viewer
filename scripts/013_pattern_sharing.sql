-- Migration: Pattern Sharing Feature
-- Allows users to share pattern collections with customers for ranking

-- Shared collections (the share itself)
CREATE TABLE IF NOT EXISTS shared_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast token lookups (public access)
CREATE INDEX IF NOT EXISTS idx_shared_collections_token ON shared_collections(token);
-- Index for listing user's shares
CREATE INDEX IF NOT EXISTS idx_shared_collections_created_by ON shared_collections(created_by);

-- Patterns in each shared collection
CREATE TABLE IF NOT EXISTS shared_collection_patterns (
  id SERIAL PRIMARY KEY,
  collection_id UUID REFERENCES shared_collections(id) ON DELETE CASCADE NOT NULL,
  pattern_id INT REFERENCES patterns(id) ON DELETE CASCADE NOT NULL,
  position INT NOT NULL CHECK (position >= 1 AND position <= 10),
  UNIQUE(collection_id, pattern_id)
);

-- Index for fetching patterns by collection
CREATE INDEX IF NOT EXISTS idx_shared_collection_patterns_collection
  ON shared_collection_patterns(collection_id);

-- Customer feedback/rankings (one per collection)
CREATE TABLE IF NOT EXISTS shared_collection_feedback (
  id SERIAL PRIMARY KEY,
  collection_id UUID REFERENCES shared_collections(id) ON DELETE CASCADE NOT NULL UNIQUE,
  rankings JSONB NOT NULL,  -- [{pattern_id: 123, rank: 1}, ...]
  customer_name TEXT,
  customer_notes TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE shared_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_collection_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_collection_feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_collections

-- Creators can view their own shares
DROP POLICY IF EXISTS "Users can view own shares" ON shared_collections;
CREATE POLICY "Users can view own shares"
  ON shared_collections FOR SELECT
  USING (auth.uid() = created_by);

-- Creators can create shares (must be approved user)
DROP POLICY IF EXISTS "Approved users can create shares" ON shared_collections;
CREATE POLICY "Approved users can create shares"
  ON shared_collections FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_approved = true)
  );

-- Creators can delete their own shares
DROP POLICY IF EXISTS "Users can delete own shares" ON shared_collections;
CREATE POLICY "Users can delete own shares"
  ON shared_collections FOR DELETE
  USING (auth.uid() = created_by);

-- Public can view shares by token (for the public share page)
-- This uses a service role bypass - we'll handle token validation in the API

-- RLS Policies for shared_collection_patterns

-- Users can view patterns in their own shares
DROP POLICY IF EXISTS "Users can view own share patterns" ON shared_collection_patterns;
CREATE POLICY "Users can view own share patterns"
  ON shared_collection_patterns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_collections sc
      WHERE sc.id = collection_id AND sc.created_by = auth.uid()
    )
  );

-- Users can add patterns to their own shares
DROP POLICY IF EXISTS "Users can add patterns to own shares" ON shared_collection_patterns;
CREATE POLICY "Users can add patterns to own shares"
  ON shared_collection_patterns FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shared_collections sc
      WHERE sc.id = collection_id AND sc.created_by = auth.uid()
    )
  );

-- Users can remove patterns from their own shares
DROP POLICY IF EXISTS "Users can remove patterns from own shares" ON shared_collection_patterns;
CREATE POLICY "Users can remove patterns from own shares"
  ON shared_collection_patterns FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM shared_collections sc
      WHERE sc.id = collection_id AND sc.created_by = auth.uid()
    )
  );

-- RLS Policies for shared_collection_feedback

-- Creators can view feedback on their shares
DROP POLICY IF EXISTS "Users can view feedback on own shares" ON shared_collection_feedback;
CREATE POLICY "Users can view feedback on own shares"
  ON shared_collection_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shared_collections sc
      WHERE sc.id = collection_id AND sc.created_by = auth.uid()
    )
  );

-- Public can submit feedback (handled via service role in API to validate token)
-- No direct INSERT policy for anon - API handles validation

-- Function to get share by token (bypasses RLS for public access)
CREATE OR REPLACE FUNCTION get_share_by_token(share_token TEXT)
RETURNS TABLE (
  id UUID,
  token TEXT,
  created_by UUID,
  creator_email TEXT,
  creator_name TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  has_feedback BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    sc.id,
    sc.token,
    sc.created_by,
    p.email as creator_email,
    p.display_name as creator_name,
    sc.recipient_email,
    sc.recipient_name,
    sc.message,
    sc.expires_at,
    sc.created_at,
    EXISTS (SELECT 1 FROM shared_collection_feedback f WHERE f.collection_id = sc.id) as has_feedback
  FROM shared_collections sc
  LEFT JOIN profiles p ON p.id = sc.created_by
  WHERE sc.token = share_token
    AND sc.expires_at > NOW();
$$;

-- Function to get patterns in a share by token (bypasses RLS for public access)
CREATE OR REPLACE FUNCTION get_share_patterns_by_token(share_token TEXT)
RETURNS TABLE (
  pattern_id INT,
  position INT,
  file_name TEXT,
  thumbnail_url TEXT,
  author TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    scp.pattern_id,
    scp.position,
    pat.file_name,
    pat.thumbnail_url,
    pat.author
  FROM shared_collection_patterns scp
  INNER JOIN shared_collections sc ON sc.id = scp.collection_id
  INNER JOIN patterns pat ON pat.id = scp.pattern_id
  WHERE sc.token = share_token
    AND sc.expires_at > NOW()
  ORDER BY scp.position;
$$;

-- Function to submit feedback (bypasses RLS, validates token)
CREATE OR REPLACE FUNCTION submit_share_feedback(
  share_token TEXT,
  feedback_rankings JSONB,
  feedback_customer_name TEXT DEFAULT NULL,
  feedback_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  share_id UUID;
BEGIN
  -- Get the share ID and validate it exists and isn't expired
  SELECT id INTO share_id
  FROM shared_collections
  WHERE token = share_token AND expires_at > NOW();

  IF share_id IS NULL THEN
    RAISE EXCEPTION 'Share not found or expired';
  END IF;

  -- Check if feedback already exists
  IF EXISTS (SELECT 1 FROM shared_collection_feedback WHERE collection_id = share_id) THEN
    RAISE EXCEPTION 'Feedback already submitted for this share';
  END IF;

  -- Insert the feedback
  INSERT INTO shared_collection_feedback (collection_id, rankings, customer_name, customer_notes)
  VALUES (share_id, feedback_rankings, feedback_customer_name, feedback_notes);

  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_share_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_share_patterns_by_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_share_feedback(TEXT, JSONB, TEXT, TEXT) TO anon, authenticated;
