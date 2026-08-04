-- ============================================================
-- TLC Attendance SaaS — Migration 007
-- Description: Add ended_at to sessions and restrict scans insertion
-- ============================================================

ALTER TABLE sessions 
  ADD COLUMN ended_at TIMESTAMPTZ;

COMMENT ON COLUMN sessions.ended_at IS 'When the session was marked as ended by a troop admin. Once set, no further scans can be inserted.';

-- Drop existing scans insert policy
DROP POLICY IF EXISTS "scans_insert_own_troop" ON scans;

-- Recreate it to also check that the session is not ended
CREATE POLICY "scans_insert_own_troop"
  ON scans FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions 
      WHERE troop_id IN (SELECT user_troop_ids())
        AND ended_at IS NULL
    )
  );
