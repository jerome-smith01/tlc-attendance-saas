-- ============================================================
-- TLC Attendance SaaS — MVP-1 RLS Policies
-- Migration: 002_rls_policies.sql
-- ============================================================

-- ==========================================
-- HELPER FUNCTION
-- ==========================================

CREATE OR REPLACE FUNCTION user_troop_ids()
RETURNS SETOF UUID AS $$
  SELECT troop_id FROM troop_users WHERE user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION user_troop_ids() IS
  'Returns the set of troop_ids the current user belongs to. Used in all RLS policies.';


-- ==========================================
-- Helper for role-based checks
-- ==========================================

CREATE OR REPLACE FUNCTION user_has_role_in_troop(p_troop_id UUID, p_roles troop_role[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM troop_users
    WHERE user_id = auth.uid()
      AND troop_id = p_troop_id
      AND role = ANY(p_roles)
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION user_has_role_in_troop IS
  'Returns true if the current user has any of the specified roles in the given troop.';


-- ==========================================
-- 1. TROOPS
-- ==========================================

ALTER TABLE troops ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can only see troops they belong to
CREATE POLICY "troops_select_own"
  ON troops FOR SELECT
  USING (id IN (SELECT user_troop_ids()));

-- UPDATE: Only billing_admin can update troop settings
CREATE POLICY "troops_update_billing_admin"
  ON troops FOR UPDATE
  USING (user_has_role_in_troop(id, ARRAY['billing_admin']::troop_role[]));

-- INSERT/DELETE: Denied by default (no policies = blocked when RLS is on)


-- ==========================================
-- 2. TROOP_USERS
-- ==========================================

ALTER TABLE troop_users ENABLE ROW LEVEL SECURITY;

-- SELECT: Users can see all members of their own troops
CREATE POLICY "troop_users_select_own_troops"
  ON troop_users FOR SELECT
  USING (troop_id IN (SELECT user_troop_ids()));

-- INSERT: Only admin+ can invite users to their troop
CREATE POLICY "troop_users_insert_admin"
  ON troop_users FOR INSERT
  WITH CHECK (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'admin']::troop_role[]));

-- UPDATE: Only admin+ can change roles within their troop
CREATE POLICY "troop_users_update_admin"
  ON troop_users FOR UPDATE
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'admin']::troop_role[]));

-- DELETE: Only admin+ can remove users from their troop
CREATE POLICY "troop_users_delete_admin"
  ON troop_users FOR DELETE
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'admin']::troop_role[]));


-- ==========================================
-- 3. ROSTER
-- ==========================================

ALTER TABLE roster ENABLE ROW LEVEL SECURITY;

-- SELECT: Any troop member can view the roster
CREATE POLICY "roster_select_own_troop"
  ON roster FOR SELECT
  USING (troop_id IN (SELECT user_troop_ids()));

-- INSERT: Any troop member can add roster entries (on-the-fly badge scanning)
CREATE POLICY "roster_insert_own_troop"
  ON roster FOR INSERT
  WITH CHECK (troop_id IN (SELECT user_troop_ids()));

-- UPDATE: Any troop member can update roster entries (tlc_id backfill on first scan)
CREATE POLICY "roster_update_own_troop"
  ON roster FOR UPDATE
  USING (troop_id IN (SELECT user_troop_ids()));

-- DELETE: Only admin+ can remove roster entries
CREATE POLICY "roster_delete_admin"
  ON roster FOR DELETE
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'admin']::troop_role[]));


-- ==========================================
-- 4. SESSIONS
-- ==========================================

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- SELECT: Any troop member can view sessions
CREATE POLICY "sessions_select_own_troop"
  ON sessions FOR SELECT
  USING (troop_id IN (SELECT user_troop_ids()));

-- INSERT: Any troop member can create sessions
CREATE POLICY "sessions_insert_own_troop"
  ON sessions FOR INSERT
  WITH CHECK (troop_id IN (SELECT user_troop_ids()));

-- UPDATE: Only admin+ can update sessions
CREATE POLICY "sessions_update_admin"
  ON sessions FOR UPDATE
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'admin']::troop_role[]));

-- DELETE: Only admin+ can delete sessions
CREATE POLICY "sessions_delete_admin"
  ON sessions FOR DELETE
  USING (user_has_role_in_troop(troop_id, ARRAY['billing_admin', 'admin']::troop_role[]));


-- ==========================================
-- 5. SCANS
-- ==========================================

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

-- SELECT: Any troop member can view scans for their troop's sessions
CREATE POLICY "scans_select_own_troop"
  ON scans FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE troop_id IN (SELECT user_troop_ids())
    )
  );

-- INSERT: Any troop member can create scans
CREATE POLICY "scans_insert_own_troop"
  ON scans FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE troop_id IN (SELECT user_troop_ids())
    )
  );

-- UPDATE: Only admin+ can update scan status (approve/complete)
CREATE POLICY "scans_update_admin"
  ON scans FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM sessions
      WHERE troop_id IN (
        SELECT troop_id FROM troop_users
        WHERE user_id = auth.uid() AND role IN ('billing_admin', 'admin')
      )
    )
  );

-- DELETE: Only admin+ can delete scans
CREATE POLICY "scans_delete_admin"
  ON scans FOR DELETE
  USING (
    session_id IN (
      SELECT id FROM sessions
      WHERE troop_id IN (
        SELECT troop_id FROM troop_users
        WHERE user_id = auth.uid() AND role IN ('billing_admin', 'admin')
      )
    )
  );
