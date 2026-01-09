-- Migration: Allow admins to update pattern metadata and manage keywords
-- Run this in Supabase SQL Editor

-- Allow admins to update pattern metadata
CREATE POLICY "Admins can update patterns" ON patterns
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Allow admins to manage pattern_keywords junction table
CREATE POLICY "Admins can insert pattern_keywords" ON pattern_keywords
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "Admins can delete pattern_keywords" ON pattern_keywords
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );
