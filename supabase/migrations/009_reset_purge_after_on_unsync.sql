-- ============================================================
-- TLC Attendance SaaS — Migration 009
-- Description: Reset purge_after to NULL when synced_at is cleared
-- ============================================================

CREATE OR REPLACE FUNCTION set_purge_after_on_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.synced_at IS NULL AND NEW.synced_at IS NOT NULL) THEN
    NEW.purge_after = NEW.synced_at + INTERVAL '14 days';
  ELSIF (NEW.synced_at IS NULL) THEN
    NEW.purge_after = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
