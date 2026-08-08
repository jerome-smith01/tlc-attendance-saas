-- ============================================================
-- TLC Attendance SaaS — Migration 010 (Safe & Idempotent)
-- Rename 'sessions' table to 'events' and 'session_id' to 'event_id'
-- ============================================================

-- 1. Rename table if 'sessions' still exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sessions') THEN
    ALTER TABLE public.sessions RENAME TO events;
  END IF;
END $$;

-- 2. Rename column in scans if 'session_id' still exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'scans' AND column_name = 'session_id') THEN
    ALTER TABLE public.scans RENAME COLUMN session_id TO event_id;
  END IF;
END $$;

-- 3. Rename indexes if they exist
ALTER INDEX IF EXISTS idx_sessions_troop_id    RENAME TO idx_events_troop_id;
ALTER INDEX IF EXISTS idx_sessions_troop_date  RENAME TO idx_events_troop_date;
ALTER INDEX IF EXISTS idx_scans_session_id     RENAME TO idx_scans_event_id;
ALTER INDEX IF EXISTS idx_scans_status         RENAME TO idx_scans_event_status;

-- 4. Recreate RLS Policies on events
DROP POLICY IF EXISTS sessions_select_own_troop ON events;
DROP POLICY IF EXISTS sessions_insert_own_troop ON events;
DROP POLICY IF EXISTS sessions_update_admin     ON events;
DROP POLICY IF EXISTS sessions_delete_admin     ON events;
DROP POLICY IF EXISTS events_select_own_troop   ON events;
DROP POLICY IF EXISTS events_insert_own_troop   ON events;
DROP POLICY IF EXISTS events_update_admin       ON events;
DROP POLICY IF EXISTS events_delete_admin       ON events;

CREATE POLICY events_select_own_troop ON events
  FOR SELECT USING (troop_id IN (
    SELECT troop_id FROM troop_users WHERE user_id = auth.uid()
  ));

CREATE POLICY events_insert_own_troop ON events
  FOR INSERT WITH CHECK (troop_id IN (
    SELECT troop_id FROM troop_users WHERE user_id = auth.uid()
  ));

CREATE POLICY events_update_admin ON events
  FOR UPDATE USING (troop_id IN (
    SELECT troop_id FROM troop_users
    WHERE user_id = auth.uid() AND role IN ('billing_admin', 'troop_admin')
  ));

CREATE POLICY events_delete_admin ON events
  FOR DELETE USING (troop_id IN (
    SELECT troop_id FROM troop_users
    WHERE user_id = auth.uid() AND role IN ('billing_admin', 'troop_admin')
  ));

-- 5. Safely rename triggers if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sessions_purge_scans') THEN
    ALTER TRIGGER trg_sessions_purge_scans ON events RENAME TO trg_events_purge_scans;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sessions_set_purge_after') THEN
    ALTER TRIGGER trg_sessions_set_purge_after ON events RENAME TO trg_events_set_purge_after;
  END IF;
END $$;
