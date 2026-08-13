-- ============================================================
-- TLC Attendance SaaS — Migration 017
-- Description: Rename roles troop_admin -> roster_manager,
-- billing_admin -> troop_admin. Recreate policies.
-- ============================================================

-- 1. Drop existing RLS policies that hardcode the array values
DROP POLICY IF EXISTS "troops_update_billing_admin" ON troops;
DROP POLICY IF EXISTS "troop_users_insert_admin" ON troop_users;
DROP POLICY IF EXISTS "troop_users_update_admin" ON troop_users;
DROP POLICY IF EXISTS "troop_users_delete_admin" ON troop_users;
DROP POLICY IF EXISTS "roster_delete_admin" ON roster;
DROP POLICY IF EXISTS "events_update_admin" ON events;
DROP POLICY IF EXISTS "events_delete_admin" ON events;
DROP POLICY IF EXISTS "scans_update_admin" ON scans;
DROP POLICY IF EXISTS "scans_delete_admin" ON scans;
DROP POLICY IF EXISTS "pending_invites_select_admin" ON pending_invites;
DROP POLICY IF EXISTS "pending_invites_delete_admin" ON pending_invites;

-- Drop the helper function that uses the enum array type
DROP FUNCTION IF EXISTS user_has_role_in_troop(UUID, troop_role[]);

-- 2. Alter the ENUM
ALTER TYPE troop_role RENAME VALUE 'troop_admin' TO 'roster_manager';
ALTER TYPE troop_role RENAME VALUE 'billing_admin' TO 'troop_admin';

-- 3. Recreate the helper function
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

-- 4. Recreate RLS policies with new role names

-- troops table
CREATE POLICY "troops_update_billing_admin"
  ON troops FOR UPDATE
  USING (user_has_role_in_troop(id, ARRAY['troop_admin']::troop_role[]));

-- troop_users table
CREATE POLICY "troop_users_insert_admin"
  ON troop_users FOR INSERT
  WITH CHECK (user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager']::troop_role[]));

CREATE POLICY "troop_users_update_admin"
  ON troop_users FOR UPDATE
  USING (user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager']::troop_role[]));

CREATE POLICY "troop_users_delete_admin"
  ON troop_users FOR DELETE
  USING (user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager']::troop_role[]));

-- roster table
CREATE POLICY "roster_delete_admin"
  ON roster FOR DELETE
  USING (user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager']::troop_role[]));

-- events table
CREATE POLICY "events_update_admin"
  ON events FOR UPDATE
  USING (user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager']::troop_role[]));

CREATE POLICY "events_delete_admin"
  ON events FOR DELETE
  USING (user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager']::troop_role[]));

-- scans table
CREATE POLICY "scans_update_admin"
  ON scans FOR UPDATE
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager']::troop_role[])
    )
  );

CREATE POLICY "scans_delete_admin"
  ON scans FOR DELETE
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager']::troop_role[])
    )
  );

-- pending_invites table
CREATE POLICY "pending_invites_select_admin"
  ON pending_invites FOR SELECT
  USING (user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager']::troop_role[]));

CREATE POLICY "pending_invites_delete_admin"
  ON pending_invites FOR DELETE
  USING (user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager']::troop_role[]));
