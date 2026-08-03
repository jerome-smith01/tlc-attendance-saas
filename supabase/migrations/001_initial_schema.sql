-- ============================================================
-- TLC Attendance SaaS — MVP-1 Initial Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- ---------- ENUM TYPES ----------

CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'unpaid');
CREATE TYPE troop_role AS ENUM ('billing_admin', 'admin', 'member');
CREATE TYPE scan_status AS ENUM ('pending', 'approved', 'complete');


-- ---------- 1. TROOPS ----------

CREATE TABLE troops (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  troop_number          TEXT NOT NULL UNIQUE,
  city                  TEXT NOT NULL,
  state                 CHAR(2) NOT NULL,
  stripe_customer_id    TEXT,
  subscription_status   subscription_status,
  subscription_ends_at  TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE troops IS 'Each troop is a tenant. MVP-1 has SC-0110 (real) and DEMO-001 (test).';


-- ---------- 2. TROOP_USERS (junction) ----------

CREATE TABLE troop_users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  troop_id               UUID NOT NULL REFERENCES troops(id) ON DELETE CASCADE,
  role                   troop_role NOT NULL DEFAULT 'member',
  onboarding_completed   BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, troop_id)
);

COMMENT ON TABLE troop_users IS 'Junction table linking auth.users to troops with a role. Central to all RLS policies.';

CREATE INDEX idx_troop_users_user_id ON troop_users(user_id);
CREATE INDEX idx_troop_users_troop_id ON troop_users(troop_id);


-- ---------- 3. ROSTER ----------

CREATE TABLE roster (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  troop_id      UUID NOT NULL REFERENCES troops(id) ON DELETE CASCADE,
  first_name    TEXT NOT NULL,
  last_initial  CHAR(1) NOT NULL,
  member_id     TEXT,
  tlc_id        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (troop_id, member_id),
  UNIQUE (troop_id, tlc_id)
);

COMMENT ON TABLE roster IS 'Troop members (youth). COPPA-safe: first name + last initial only.';
COMMENT ON COLUMN roster.tlc_id IS '12-char alphanumeric ID embedded in QR badge. Populated on first scan.';
COMMENT ON COLUMN roster.member_id IS 'Badge-printed ID in YYYY-NNNNNN format. Primary import key from CSV.';

CREATE INDEX idx_roster_troop_id ON roster(troop_id);
CREATE INDEX idx_roster_troop_tlc_id ON roster(troop_id, tlc_id) WHERE tlc_id IS NOT NULL;
CREATE INDEX idx_roster_troop_member_id ON roster(troop_id, member_id) WHERE member_id IS NOT NULL;


-- ---------- 4. SESSIONS ----------

CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  troop_id    UUID NOT NULL REFERENCES troops(id) ON DELETE CASCADE,
  event_name  TEXT NOT NULL,
  event_date  DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (troop_id, event_name, event_date)
);

COMMENT ON TABLE sessions IS 'An attendance session = one event on one date for one troop.';

CREATE INDEX idx_sessions_troop_id ON sessions(troop_id);
CREATE INDEX idx_sessions_troop_date ON sessions(troop_id, event_date);


-- ---------- 5. SCANS ----------

CREATE TABLE scans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  roster_id   UUID NOT NULL REFERENCES roster(id) ON DELETE CASCADE,
  scan_time   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      scan_status NOT NULL DEFAULT 'pending',

  UNIQUE (session_id, roster_id)
);

COMMENT ON TABLE scans IS 'Individual attendance scans. Status lifecycle: pending → approved → complete.';

CREATE INDEX idx_scans_session_id ON scans(session_id);
CREATE INDEX idx_scans_roster_id ON scans(roster_id);
CREATE INDEX idx_scans_status ON scans(session_id, status);


-- ---------- UPDATED_AT TRIGGER ----------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_troops_updated_at
  BEFORE UPDATE ON troops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_roster_updated_at
  BEFORE UPDATE ON roster
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------- SEED DATA ----------

-- Real troop
INSERT INTO troops (troop_number, city, state)
VALUES ('SC-0110', 'Spartanburg', 'SC');

-- Demo troop for cross-troop RLS isolation testing
INSERT INTO troops (troop_number, city, state)
VALUES ('DEMO-001', 'Testville', 'SC');

-- Seed some demo roster data into DEMO-001 so RLS isolation is testable
INSERT INTO roster (troop_id, first_name, last_initial, member_id)
VALUES
  ((SELECT id FROM troops WHERE troop_number = 'DEMO-001'), 'Demo', 'A', '0000-000001'),
  ((SELECT id FROM troops WHERE troop_number = 'DEMO-001'), 'Test', 'B', '0000-000002');


-- ============================================================
-- MANUAL STEP AFTER MIGRATION:
-- ============================================================
-- After creating your auth account in Supabase (Authentication → Users),
-- copy your user UUID and run this in the SQL Editor:
--
--   INSERT INTO troop_users (user_id, troop_id, role)
--   VALUES (
--     '<YOUR_AUTH_UUID>',
--     (SELECT id FROM troops WHERE troop_number = 'SC-0110'),
--     'billing_admin'
--   );
--
-- DO NOT add yourself to DEMO-001. That troop exists solely to verify
-- that your account cannot see its data.
-- ============================================================
