-- Migration: Add function to get approved users with last login time
-- This joins profiles with auth.users to get last_sign_in_at

CREATE OR REPLACE FUNCTION get_approved_users_with_login()
RETURNS TABLE (
  id UUID,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    p.display_name,
    p.created_at,
    p.approved_at,
    u.last_sign_in_at
  FROM profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  WHERE p.is_approved = true
  ORDER BY p.approved_at DESC NULLS LAST;
$$;

-- Grant execute to authenticated users (admin check happens in application)
GRANT EXECUTE ON FUNCTION get_approved_users_with_login() TO authenticated;
