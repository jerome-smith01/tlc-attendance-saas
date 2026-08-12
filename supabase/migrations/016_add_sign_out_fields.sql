-- ============================================================
-- TLC Attendance SaaS — Migration 016
-- Add Sign In / Sign Out audit fields to scans table
-- ============================================================

DO $$
BEGIN
  -- 1. Rename 'scan_time' to 'sign_in_time' if it exists, or add 'sign_in_time'
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scans' AND column_name = 'scan_time') THEN
    ALTER TABLE public.scans RENAME COLUMN scan_time TO sign_in_time;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scans' AND column_name = 'sign_in_time') THEN
    ALTER TABLE public.scans ADD COLUMN sign_in_time TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;

  -- 2. Rename 'scanned_by' to 'signed_in_by' if it exists, or add 'signed_in_by'
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scans' AND column_name = 'scanned_by') THEN
    ALTER TABLE public.scans RENAME COLUMN scanned_by TO signed_in_by;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scans' AND column_name = 'signed_in_by') THEN
    ALTER TABLE public.scans ADD COLUMN signed_in_by UUID REFERENCES auth.users(id);
  END IF;

  -- 3. Add 'sign_out_time' column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scans' AND column_name = 'sign_out_time') THEN
    ALTER TABLE public.scans ADD COLUMN sign_out_time TIMESTAMPTZ;
  END IF;

  -- 4. Add 'signed_out_by' column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scans' AND column_name = 'signed_out_by') THEN
    ALTER TABLE public.scans ADD COLUMN signed_out_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Indexes for audit filtering
CREATE INDEX IF NOT EXISTS idx_scans_signed_in_by ON public.scans(signed_in_by);
CREATE INDEX IF NOT EXISTS idx_scans_signed_out_by ON public.scans(signed_out_by);
