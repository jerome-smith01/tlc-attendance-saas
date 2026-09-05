-- ============================================================
-- Migration: 020_add_membership_exp.sql
-- Description: Adds membership_exp (DATE) column to roster.
--              Nullable so existing rows and leaders without
--              an expiry date are unaffected.
-- ============================================================

ALTER TABLE roster
  ADD COLUMN membership_exp DATE;

COMMENT ON COLUMN roster.membership_exp IS 'Membership expiration date imported from the TLC roster CSV (Membership Exp. field). Null means unknown/not set.';
