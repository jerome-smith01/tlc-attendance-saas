CREATE TABLE pending_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  troop_id    UUID NOT NULL REFERENCES troops(id) ON DELETE CASCADE,
  role        troop_role NOT NULL,
  token       UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No direct user access — only the service role (Edge Function) reads/writes this table.
ALTER TABLE pending_invites ENABLE ROW LEVEL SECURITY;
