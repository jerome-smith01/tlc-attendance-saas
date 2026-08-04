-- ============================================================
-- TLC Attendance SaaS — MVP-1 Migration 003
-- Migration: 003_roles_and_sync.sql
-- Description: Rename roles, add global_admins, and add session sync/purge logic
-- ============================================================

-- ---------- 1. RENAME ROLES ENUM ----------

-- PostgreSQL 10+ supports RENAME VALUE
ALTER TYPE troop_role RENAME VALUE 'admin' TO 'troop_admin';
ALTER TYPE troop_role RENAME VALUE 'member' TO 'badge_scanner';


-- ---------- 2. GLOBAL ADMINS TABLE ----------

CREATE TABLE global_admins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE (user_id)
);

COMMENT ON TABLE global_admins IS 'Users who have system-wide access to all troops (e.g. platform owners).';

CREATE INDEX idx_global_admins_user_id ON global_admins(user_id);


-- ---------- 3. SESSION SYNC TRACKING ----------

ALTER TABLE sessions 
  ADD COLUMN synced_at TIMESTAMPTZ,
  ADD COLUMN synced_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN sessions.synced_at IS 'When the session was synced back to Trail Life Connect.';
COMMENT ON COLUMN sessions.synced_by IS 'Which user performed the sync.';


-- ---------- 4. SCANS PURGE TRIGGER ----------

-- This function purges all raw scan data (removing PII linkage) for a session
-- once the session is marked as synced.
CREATE OR REPLACE FUNCTION purge_scans_on_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if synced_at was just set
  IF (OLD.synced_at IS NULL AND NEW.synced_at IS NOT NULL) THEN
    -- Delete all child records in the scans table
    DELETE FROM scans WHERE session_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sessions_purge_scans
  AFTER UPDATE OF synced_at ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION purge_scans_on_sync();
