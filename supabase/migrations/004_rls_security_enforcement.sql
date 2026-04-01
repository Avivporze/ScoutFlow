-- ============================================================
-- 004_rls_security_enforcement.sql
-- Enforces strict isolation: users can only access their own data.
-- Includes an Admin override mapping allowing global visibility.
-- ============================================================

-- Create a helper function for Admin Role evaluation to optimize RLS queries
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------------
-- 1. PLAYERS: Isolate by `added_by`, bypass for Admins
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read all players" ON players;
DROP POLICY IF EXISTS "Authenticated users can insert players" ON players;
DROP POLICY IF EXISTS "Authenticated users can update players" ON players;
DROP POLICY IF EXISTS "Admins can delete players" ON players;
DROP POLICY IF EXISTS "Users can only read their own players" ON players;
DROP POLICY IF EXISTS "Users can only insert their own players" ON players;
DROP POLICY IF EXISTS "Users can only update their own players" ON players;
DROP POLICY IF EXISTS "Users can only delete their own players" ON players;

CREATE POLICY "Users can read players they own, Admins can read all"
  ON players FOR SELECT TO authenticated
  USING (added_by = auth.uid() OR is_admin());

CREATE POLICY "Users can insert their own players"
  ON players FOR INSERT TO authenticated
  WITH CHECK (added_by = auth.uid() OR is_admin());

CREATE POLICY "Users can update their own players, Admins update all"
  ON players FOR UPDATE TO authenticated
  USING (added_by = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own players, Admins delete all"
  ON players FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR is_admin());


-- -------------------------------------------------------------
-- 2. INTERNAL TEAMS: Owner isolation, Admin bypass
-- -------------------------------------------------------------
ALTER TABLE internal_teams 
ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES profiles(id) DEFAULT auth.uid();

DROP POLICY IF EXISTS "Authenticated users can read all teams" ON internal_teams;
DROP POLICY IF EXISTS "Admins can insert teams" ON internal_teams;
DROP POLICY IF EXISTS "Admins can update teams" ON internal_teams;
DROP POLICY IF EXISTS "Admins can delete teams" ON internal_teams;
DROP POLICY IF EXISTS "Users can read their own teams" ON internal_teams;
DROP POLICY IF EXISTS "Users can insert their own teams" ON internal_teams;
DROP POLICY IF EXISTS "Users can update their own teams" ON internal_teams;
DROP POLICY IF EXISTS "Users can delete their own teams" ON internal_teams;

CREATE POLICY "Users can read their own teams, Admins read all"
  ON internal_teams FOR SELECT TO authenticated
  USING (added_by = auth.uid() OR is_admin());

CREATE POLICY "Users can insert their own teams, Admins insert all"
  ON internal_teams FOR INSERT TO authenticated
  WITH CHECK (added_by = auth.uid() OR is_admin());

CREATE POLICY "Users can update their own teams, Admins update all"
  ON internal_teams FOR UPDATE TO authenticated
  USING (added_by = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own teams, Admins delete all"
  ON internal_teams FOR DELETE TO authenticated
  USING (added_by = auth.uid() OR is_admin());


-- -------------------------------------------------------------
-- 3. PLAYER NOTES: Isolate by `author_id`, Admin bypass
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read all notes" ON player_notes;
DROP POLICY IF EXISTS "Authenticated users can insert notes" ON player_notes;
DROP POLICY IF EXISTS "Users can read their own notes" ON player_notes;
DROP POLICY IF EXISTS "Users can insert their own notes" ON player_notes;
DROP POLICY IF EXISTS "Authors can update their own notes" ON player_notes;
DROP POLICY IF EXISTS "Authors can delete their own notes" ON player_notes;

CREATE POLICY "Users can read their own notes, Admins read all"
  ON player_notes FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert their own notes, Admins insert all"
  ON player_notes FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() OR is_admin());

CREATE POLICY "Users can update their own notes, Admins update all"
  ON player_notes FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own notes, Admins delete all"
  ON player_notes FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR is_admin());


-- -------------------------------------------------------------
-- 4. ACTIVITY LOG: Isolate by `user_id`, Admin bypass
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read activity log" ON activity_log;
DROP POLICY IF EXISTS "Users can read their own activity base" ON activity_log;

CREATE POLICY "Users can read their own activity base, Admins read all"
  ON activity_log FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());


-- -------------------------------------------------------------
-- 5. PROFILES: Privacy isolation, Admin bypass
-- -------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;

CREATE POLICY "Users can read their own profile, Admins read all"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());
