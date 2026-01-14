-- Migration: Secure admin-only RPC functions
--
-- Issue: get_approved_users_with_login() and count_active_users() use
-- SECURITY DEFINER and are executable by any authenticated user, exposing
-- user enumeration and PII (emails, names, login times).
--
-- Fix: Add is_admin check inside the functions. Non-admins get empty results
-- or zero counts rather than an error, to avoid leaking admin status.

-- Recreate get_approved_users_with_login with admin check
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
    -- Admin check: only return results if caller is admin
    AND EXISTS (
      SELECT 1 FROM profiles caller
      WHERE caller.id = auth.uid()
      AND caller.is_admin = true
    )
  ORDER BY p.approved_at DESC NULLS LAST;
$$;

-- Recreate count_active_users with admin check
CREATE OR REPLACE FUNCTION count_active_users(days_ago INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      -- Only return actual count if caller is admin
      WHEN EXISTS (
        SELECT 1 FROM profiles caller
        WHERE caller.id = auth.uid()
        AND caller.is_admin = true
      )
      THEN (
        SELECT COUNT(*)::INTEGER
        FROM auth.users u
        INNER JOIN profiles p ON p.id = u.id
        WHERE u.last_sign_in_at >= (NOW() - (days_ago || ' days')::INTERVAL)
          AND p.is_approved = true
      )
      ELSE 0
    END;
$$;
