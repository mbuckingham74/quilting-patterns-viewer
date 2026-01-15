-- Migration: Create admin activity log table for audit trail
-- Track all admin actions for accountability and debugging

CREATE TABLE admin_activity_log (
  id SERIAL PRIMARY KEY,

  -- Who performed the action
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  -- What action was performed
  action_type TEXT NOT NULL,

  -- Target entity (polymorphic - can be pattern, keyword, user, etc.)
  target_type TEXT NOT NULL,  -- 'pattern', 'keyword', 'user', 'batch'
  target_id TEXT,             -- ID of affected entity (text to support UUID or INT)

  -- Human-readable description
  description TEXT NOT NULL,

  -- Additional context as JSONB (flexible for different action types)
  details JSONB DEFAULT '{}'::jsonb,

  -- When it happened
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_admin_activity_admin ON admin_activity_log(admin_id);
CREATE INDEX idx_admin_activity_action ON admin_activity_log(action_type);
CREATE INDEX idx_admin_activity_target ON admin_activity_log(target_type, target_id);
CREATE INDEX idx_admin_activity_date ON admin_activity_log(created_at DESC);

-- Composite index for common filter combinations
CREATE INDEX idx_admin_activity_action_date ON admin_activity_log(action_type, created_at DESC);

-- Enable RLS
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view activity logs
CREATE POLICY "Admins can view activity logs"
  ON admin_activity_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Grant permissions
GRANT SELECT ON admin_activity_log TO authenticated;
GRANT INSERT ON admin_activity_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE admin_activity_log_id_seq TO service_role;
