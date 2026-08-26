-- Distinguishes conditions that stay true over time from single observations.
--
-- Without this, history cannot tell an unresolved condition from a point-in-time
-- detection: kinematic events never carry a resolved_at, so every steep climb ever
-- recorded would read as "still open" to a later query.
ALTER TABLE anomalies
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'state';

-- Backfill from what the type already tells us.
UPDATE anomalies
   SET kind = 'event'
 WHERE type IN ('RAPID_CLIMB', 'RAPID_DESCENT', 'SUDDEN_HEADING_CHANGE', 'SUDDEN_ALTITUDE_CHANGE');

CREATE INDEX IF NOT EXISTS anomalies_open_idx
  ON anomalies (icao24, type)
  WHERE resolved_at IS NULL AND kind = 'state';
