-- Add account_exists flag so the /accept-invite page knows which form to render
-- without needing to do a round-trip auth user lookup at accept time.
ALTER TABLE pending_invites ADD COLUMN IF NOT EXISTS account_exists BOOLEAN NOT NULL DEFAULT false;

-- Unique constraint on (email, troop_id) enables safe upserts and prevents
-- race conditions from double-clicks on the "Invite" button.
ALTER TABLE pending_invites
  ADD CONSTRAINT pending_invites_email_troop_unique UNIQUE (email, troop_id);

-- Secure RPC for checking if an email exists in auth.users.
-- SECURITY DEFINER: runs with the function owner's privileges so it can read auth.users.
-- SET search_path = '': prevents search_path hijacking attacks.
-- REVOKE EXECUTE from anon/authenticated: not a public endpoint; only callable
--   via service_role (Edge Function). Prevents this from being an email-enumeration oracle.
CREATE OR REPLACE FUNCTION check_email_exists(target_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(target_email)
  );
$$;

REVOKE EXECUTE ON FUNCTION check_email_exists(TEXT) FROM anon, authenticated;
