-- ============================================================
-- TLC Attendance SaaS — Migration 015
-- Description: Add RLS SELECT + DELETE policies to pending_invites
--
-- The table was originally locked to service-role only. Now that
-- the invite flow sends email via Edge Function and the frontend
-- needs to display + revoke pending invites, we open it to
-- troop_admin / billing_admin (and global_admins via the helper).
-- ============================================================

-- SELECT: Admins can view pending invites for their own troop
CREATE POLICY "pending_invites_select_admin"
  ON pending_invites FOR SELECT
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'troop_admin']::troop_role[]));

-- DELETE: Admins can revoke pending invites for their own troop
CREATE POLICY "pending_invites_delete_admin"
  ON pending_invites FOR DELETE
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'troop_admin']::troop_role[]));
