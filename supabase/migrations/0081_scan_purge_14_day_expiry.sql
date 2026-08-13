-- ============================================================
-- TLC Attendance SaaS — Migration 008
-- Description: Change scan purge from immediate to 14-day expiry.
--              Replaces the instant-delete trigger with a scheduled
--              pg_cron job that runs nightly.
-- ============================================================

-- Step 1: Drop the old immediate purge trigger and function
DROP TRIGGER IF EXISTS trg_sessions_purge_scans ON sessions;
DROP FUNCTION IF EXISTS purge_scans_on_sync();

-- Step 2: Add a purge_after column to sessions.
--         This is set automatically to synced_at + 14 days when a session is synced.
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;

COMMENT ON COLUMN sessions.purge_after IS
  'Timestamp after which raw scan data for this session is eligible for deletion. '
  'Set to synced_at + 14 days when a session is synced.';

-- Step 3: Backfill purge_after for any already-synced sessions
UPDATE sessions
SET purge_after = synced_at + INTERVAL '14 days'
WHERE synced_at IS NOT NULL AND purge_after IS NULL;

-- Step 4: Create a new trigger that sets purge_after (instead of deleting immediately)
CREATE OR REPLACE FUNCTION set_purge_after_on_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.synced_at IS NULL AND NEW.synced_at IS NOT NULL) THEN
    NEW.purge_after = NEW.synced_at + INTERVAL '14 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sessions_set_purge_after
  BEFORE UPDATE OF synced_at ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_purge_after_on_sync();

-- Step 5: Schedule a nightly pg_cron job (runs at 3:00 AM UTC) to delete
--         expired scans. pg_cron must be enabled in your Supabase project.
--         (Database → Extensions → pg_cron)
SELECT cron.schedule(
  'purge-expired-scans',      -- job name (unique)
  '0 3 * * *',                -- cron expression: every day at 03:00 UTC
  $$
    DELETE FROM scans
    WHERE session_id IN (
      SELECT id FROM sessions
      WHERE purge_after IS NOT NULL
        AND purge_after <= now()
    );
  $$
);
