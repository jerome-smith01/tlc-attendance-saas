-- ==============================================================================
-- Migration: 004_unified_roster_and_profiles.sql
-- Description: Adds role and user_id to the roster table for a unified roster
-- ==============================================================================

-- 1. Add role and user_id to roster table
ALTER TABLE roster 
  ADD COLUMN role TEXT NOT NULL DEFAULT 'trailman' 
  CHECK (role IN ('trailman', 'billing_admin', 'troop_admin', 'badge_scanner'));

ALTER TABLE roster 
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create partial unique index to ensure a user only has one roster entry per troop
CREATE UNIQUE INDEX idx_roster_troop_user ON roster(troop_id, user_id) WHERE user_id IS NOT NULL;

-- 3. Add RLS policies for user_id updates on roster
-- Allow users to update their own roster entry (when claiming profile)
CREATE POLICY "Users can update their own roster entry"
  ON roster FOR UPDATE
  USING (
    -- they must either be the linked user
    user_id = auth.uid() OR
    -- or they must have an admin role in the troop
    EXISTS (
      SELECT 1 FROM troop_users 
      WHERE troop_users.troop_id = roster.troop_id 
      AND troop_users.user_id = auth.uid() 
      AND troop_users.role IN ('troop_admin', 'billing_admin')
    )
  );

-- We also need to allow inserting a roster row where user_id = auth.uid() for self-onboarding
-- Currently the Insert policy requires the user to be a troop_admin. 
-- For a new user accepting an invite, they are already a troop_admin or badge_scanner in troop_users.
-- We can add a policy allowing them to insert into roster if they belong to the troop.
CREATE POLICY "Troop users can add themselves to the roster"
  ON roster FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM troop_users
      WHERE troop_users.troop_id = roster.troop_id
      AND troop_users.user_id = auth.uid()
    )
  );
