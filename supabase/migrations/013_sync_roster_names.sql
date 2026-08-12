-- Migration 013: Sync & Validate Roster Names Across Troops

-- 1. Validation trigger: Prevents Troop Admins from editing names of users with accounts
CREATE OR REPLACE FUNCTION validate_roster_name_update()
RETURNS TRIGGER AS $$
DECLARE
  v_is_global_admin BOOLEAN := FALSE;
BEGIN
  -- If first_name and last_initial haven't changed, allow update
  IF NEW.first_name IS NOT DISTINCT FROM OLD.first_name AND NEW.last_initial IS NOT DISTINCT FROM OLD.last_initial THEN
    RETURN NEW;
  END IF;

  -- Check if this roster record belongs to an account user (has user_id or email)
  IF OLD.user_id IS NOT NULL OR OLD.email IS NOT NULL THEN
    -- Allow if caller is the member themselves
    IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
      RETURN NEW;
    END IF;

    -- Allow if caller is a global admin
    IF auth.uid() IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM global_admins WHERE user_id = auth.uid()
      ) INTO v_is_global_admin;

      IF v_is_global_admin THEN
        RETURN NEW;
      END IF;
    END IF;

    -- Otherwise reject modification
    RAISE EXCEPTION 'Troop Admins cannot modify names for members with registered accounts. Only the member or a Global Admin can update this name.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_roster_name_update ON roster;
CREATE TRIGGER trg_validate_roster_name_update
  BEFORE UPDATE ON roster
  FOR EACH ROW
  EXECUTE FUNCTION validate_roster_name_update();

-- 2. Synchronization trigger: Synchronizes first_name and last_initial across all troops for the same user
CREATE OR REPLACE FUNCTION sync_roster_names_across_troops()
RETURNS TRIGGER AS $$
BEGIN
  -- Safeguard against recursive trigger executions
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Avoid unnecessary updates if name hasn't changed
  IF NEW.first_name IS NOT DISTINCT FROM OLD.first_name AND NEW.last_initial IS NOT DISTINCT FROM OLD.last_initial THEN
    RETURN NEW;
  END IF;

  -- Synchronize by user_id or email
  IF NEW.user_id IS NOT NULL THEN
    UPDATE roster
    SET first_name = NEW.first_name,
        last_initial = NEW.last_initial
    WHERE user_id = NEW.user_id
      AND id != NEW.id
      AND (first_name IS DISTINCT FROM NEW.first_name OR last_initial IS DISTINCT FROM NEW.last_initial);
  ELSIF NEW.email IS NOT NULL THEN
    UPDATE roster
    SET first_name = NEW.first_name,
        last_initial = NEW.last_initial
    WHERE email = NEW.email
      AND id != NEW.id
      AND (first_name IS DISTINCT FROM NEW.first_name OR last_initial IS DISTINCT FROM NEW.last_initial);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_roster_names_across_troops ON roster;
CREATE TRIGGER trg_sync_roster_names_across_troops
  AFTER UPDATE ON roster
  FOR EACH ROW
  EXECUTE FUNCTION sync_roster_names_across_troops();
