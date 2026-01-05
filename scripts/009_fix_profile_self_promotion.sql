-- Migration: Fix Profile Self-Promotion Vulnerability
--
-- SECURITY FIX: Prevents users from setting is_admin or is_approved on their own profile
--
-- Problem: The INSERT policy only checked auth.uid() = id, allowing users to
-- set is_admin=true and is_approved=true when creating their profile.
--
-- Solution:
-- 1. Replace the INSERT policy to force is_admin=false and is_approved=false
-- 2. Use AFTER INSERT trigger to promote admin emails via privileged UPDATE
--    (BEFORE INSERT won't work because RLS WITH CHECK runs after BEFORE triggers)
-- 3. Admin email list is stored in database, not client-side code

-- Step 1: Drop the vulnerable INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Step 2: Create a secure INSERT policy that forces safe defaults
-- Users can only insert their own profile with:
--   - id matching their auth.uid()
--   - email matching their JWT email (prevents spoofing admin emails)
--   - is_admin and is_approved both false
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    AND LOWER(email) = LOWER(auth.jwt()->>'email')
    AND is_admin = false
    AND is_approved = false
  );

-- Step 3: Create a table to store admin emails (server-side only, not exposed to clients)
CREATE TABLE IF NOT EXISTS admin_emails (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on admin_emails - only service role can access
ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;

-- No policies = only service role can read/write
-- This keeps the admin list completely hidden from clients

-- Step 4: Populate with current admin emails
INSERT INTO admin_emails (email) VALUES
  ('michael.buckingham74@gmail.com'),
  ('pamncharlie@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- Step 5: Create AFTER INSERT trigger function to auto-approve admins
-- Uses SECURITY DEFINER to bypass RLS for both reading admin_emails and updating profiles
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs as owner to bypass RLS
SET search_path = public
AS $$
DECLARE
  verified_email TEXT;
BEGIN
  -- Get the verified email from auth.users (not from NEW.email which could be spoofed)
  -- This is defense-in-depth since RLS also enforces email = JWT email
  SELECT email INTO verified_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Check if the VERIFIED email is in the admin list (case-insensitive)
  IF verified_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM admin_emails
    WHERE LOWER(admin_emails.email) = LOWER(verified_email)
  ) THEN
    -- Update the just-inserted row to be admin and approved
    -- This runs as owner, bypassing the "Admins can update profiles" policy
    UPDATE profiles
    SET is_admin = true,
        is_approved = true,
        approved_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Step 6: Create the trigger as AFTER INSERT
-- AFTER INSERT allows the row to pass RLS first, then we promote via privileged UPDATE
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_profile();

-- Step 7: Verify existing profiles are correctly set
-- (Run this check - admins should already be set correctly from initial migration)
-- SELECT email, is_admin, is_approved FROM profiles WHERE email IN (SELECT email FROM admin_emails);
