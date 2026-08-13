-- ============================================================
-- TLC Attendance SaaS — Migration 018
-- Description: Update roster_role_check constraint to match
-- renamed troop_role ENUM values from migration 017.
-- Old: billing_admin, troop_admin → New: troop_admin, roster_manager
-- ============================================================

ALTER TABLE roster DROP CONSTRAINT IF EXISTS roster_role_check;

ALTER TABLE roster ADD CONSTRAINT roster_role_check
  CHECK (role IN ('roster_manager', 'troop_admin', 'badge_scanner', 'global_admin', 'trailman'));
