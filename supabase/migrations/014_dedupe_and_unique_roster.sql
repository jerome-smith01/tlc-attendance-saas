-- Migration 014: Deduplicate Roster Emails and Add Unique Constraint Per Troop

-- 1. Clean up any existing duplicate roster entries for the same troop and email.
-- Keeps the entry with a non-null user_id or the most recently created record.
DELETE FROM roster a
USING roster b
WHERE a.troop_id = b.troop_id
  AND a.email IS NOT NULL
  AND b.email IS NOT NULL
  AND LOWER(a.email) = LOWER(b.email)
  AND a.id != b.id
  AND (
    -- Prefer keeping the row that has user_id populated
    (a.user_id IS NULL AND b.user_id IS NOT NULL)
    -- If both have user_id or both have NULL, keep the newest row
    OR ((a.user_id IS NOT NULL) = (b.user_id IS NOT NULL) AND a.created_at < b.created_at)
  );

-- 2. Create partial unique index on roster(troop_id, LOWER(email))
DROP INDEX IF EXISTS idx_roster_troop_lower_email;
CREATE UNIQUE INDEX idx_roster_troop_lower_email
  ON roster (troop_id, LOWER(email))
  WHERE email IS NOT NULL;
