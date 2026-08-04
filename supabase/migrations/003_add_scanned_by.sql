-- Add scanned_by to scans table to track who performed the scan
ALTER TABLE scans ADD COLUMN scanned_by UUID REFERENCES auth.users(id);

-- Optional: Add index for performance when filtering by scanner
CREATE INDEX IF NOT EXISTS idx_scans_scanned_by ON scans(scanned_by);
