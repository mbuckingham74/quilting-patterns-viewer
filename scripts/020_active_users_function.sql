-- Migration: Add function to count active users in last N days
-- This queries auth.users which is not directly accessible via RLS

CREATE OR REPLACE FUNCTION count_active_users(days_ago INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM auth.users u
  INNER JOIN profiles p ON p.id = u.id
  WHERE u.last_sign_in_at >= (NOW() - (days_ago || ' days')::INTERVAL)
    AND p.is_approved = true;
$$;

-- Grant execute to authenticated users (admin check happens in application)
GRANT EXECUTE ON FUNCTION count_active_users(INTEGER) TO authenticated;
