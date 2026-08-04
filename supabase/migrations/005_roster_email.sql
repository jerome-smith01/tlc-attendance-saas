-- ==============================================================================
-- Migration: 005_roster_email.sql
-- Description: Adds email to the roster table
-- ==============================================================================

ALTER TABLE roster ADD COLUMN email TEXT;
