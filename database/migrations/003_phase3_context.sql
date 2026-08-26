-- Phase 3 (Context): airport directory metadata and retained airspace aggregates.

-- ---------------------------------------------------------------------------
-- Airports gain classification so search and map presence can prefer real
-- destinations. The OurAirports dataset is ~80,000 rows, most of them heliports
-- and closed strips; without a type we cannot keep those out of the user's way.
-- ---------------------------------------------------------------------------
ALTER TABLE airports
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_service BOOLEAN NOT NULL DEFAULT false;

-- Viewport lookups ("which airports are on screen") scan by position.
CREATE INDEX IF NOT EXISTS airports_position_idx ON airports (latitude, longitude);
-- Search ranks scheduled airports first.
CREATE INDEX IF NOT EXISTS airports_service_idx ON airports (scheduled_service, type);

-- ---------------------------------------------------------------------------
-- Retained aggregates.
--
-- Analytics needs to answer "how has the observed picture changed over time",
-- and there is nowhere to read that from: Redis holds only the current snapshot
-- and PostgreSQL deliberately stores events rather than the position stream
-- (ARCHITECTURE §18). This is one small row per poll — counts and a histogram,
-- never per-aircraft positions — which keeps the promise that PostgreSQL is not
-- the high-frequency store while still giving the charts something real to plot.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS airspace_samples (
  id BIGSERIAL PRIMARY KEY,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observed INTEGER NOT NULL,
  airborne INTEGER NOT NULL,
  on_ground INTEGER NOT NULL,
  climbing INTEGER NOT NULL,
  descending INTEGER NOT NULL,
  level INTEGER NOT NULL,
  /** Altitude band counts, keyed by the band's lower bound in feet. */
  altitude_bands JSONB NOT NULL DEFAULT '{}'::jsonb,
  /** Ground-speed band counts, keyed by the band's lower bound in knots. */
  speed_bands JSONB NOT NULL DEFAULT '{}'::jsonb,
  active_anomalies INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS airspace_samples_observed_at_idx
  ON airspace_samples (observed_at DESC);
