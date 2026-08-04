-- ============================================================
-- TLC Attendance SaaS — Migration 006
-- Description: Update RLS policies to use 'troop_admin' instead of 'admin'
-- and grant global_admins full admin rights.
-- ============================================================

-- Update the helper function to also return true for global_admins
CREATE OR REPLACE FUNCTION user_has_role_in_troop(p_troop_id UUID, p_roles troop_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM global_admins WHERE user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM troop_users
    WHERE user_id = auth.uid()
      AND troop_id = p_troop_id
      AND role = ANY(p_roles)
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Drop and recreate the RLS policies that referenced 'admin'

-- 1. troops table
DROP POLICY IF EXISTS "troops_update_billing_admin" ON troops;
CREATE POLICY "troops_update_billing_admin"
  ON troops FOR UPDATE
  USING (user_has_role_in_troop(id, ARRAY['billing_admin']::troop_role[]));

-- 2. troop_users table
DROP POLICY IF EXISTS "troop_users_insert_admin" ON troop_users;
CREATE POLICY "troop_users_insert_admin"
  ON troop_users FOR INSERT
  WITH CHECK (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'troop_admin']::troop_role[]));

DROP POLICY IF EXISTS "troop_users_update_admin" ON troop_users;
CREATE POLICY "troop_users_update_admin"
  ON troop_users FOR UPDATE
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'troop_admin']::troop_role[]));

DROP POLICY IF EXISTS "troop_users_delete_admin" ON troop_users;
CREATE POLICY "troop_users_delete_admin"
  ON troop_users FOR DELETE
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'troop_admin']::troop_role[]));

-- 3. roster table
DROP POLICY IF EXISTS "roster_delete_admin" ON roster;
CREATE POLICY "roster_delete_admin"
  ON roster FOR DELETE
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'troop_admin']::troop_role[]));

-- 4. sessions table
DROP POLICY IF EXISTS "sessions_update_admin" ON sessions;
CREATE POLICY "sessions_update_admin"
  ON sessions FOR UPDATE
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'troop_admin']::troop_role[]));

DROP POLICY IF EXISTS "sessions_delete_admin" ON sessions;
CREATE POLICY "sessions_delete_admin"
  ON sessions FOR DELETE
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'troop_admin']::troop_role[]));

-- 5. scans table (The scans policy didn't use the helper function, it used a raw subquery! Let's update it to use the helper)
DROP POLICY IF EXISTS "scans_update_admin" ON scans;
CREATE POLICY "scans_update_admin"
  ON scans FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM sessions
      WHERE user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'troop_admin']::troop_role[])
    )
  );

DROP POLICY IF EXISTS "scans_delete_admin" ON scans;
CREATE POLICY "scans_delete_admin"
  ON scans FOR DELETE
  USING (
    session_id IN (
      SELECT id FROM sessions
      WHERE user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'troop_admin']::troop_role[])
    )
  );
