-- ============================================================
-- 005_restrict_profile_role_updates.sql
-- Prevents self-role escalation: regular users must not be able
-- to promote themselves to admin by directly updating their
-- own profile's `role` column via the Supabase API.
--
-- Replaces the permissive 001 UPDATE policies with column-aware
-- checks that only allow admin users to change the `role` field.
-- ============================================================

-- Drop old UPDATE policies from 001
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;

-- Users can update their own profile, but NOT the role column.
-- If the role column is being changed, reject unless user is admin.
CREATE POLICY "Users can update own profile, no role change"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (role = (SELECT role FROM profiles WHERE id = auth.uid()) OR is_admin())
  );

-- Admins can update any profile (including role changes)
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE TO authenticated
  USING (is_admin());
