-- ============================================================
-- TLC Attendance SaaS — Migration 019
-- Description: Allow badge_scanner role to delete attendance scans
-- ============================================================

DROP POLICY IF EXISTS "scans_delete_admin" ON scans;

CREATE POLICY "scans_delete_admin"
  ON scans FOR DELETE
  USING (
    event_id IN (
      SELECT id FROM events
      WHERE user_has_role_in_troop(troop_id, ARRAY['troop_admin', 'roster_manager', 'badge_scanner']::troop_role[])
    )
  );
