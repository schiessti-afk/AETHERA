-- Phase 4 (Memory): packed track hours and inferred flight sessions.
--
-- Positions are stored one row per aircraft-hour. Time is a seconds offset from
-- hour_start (0..3599), never epoch seconds as REAL — at ~1.79e9, REAL's resolution
-- is ~3100 s and would silently shift every replay timestamp (PHASE4 §2.4).
-- Arrays are never expanded in SQL; the API expands them (PHASE4 §2.3).
--
-- `flights` / `flight_events` were Phase 1 scaffolding that no code wrote to.
-- Modelling a flight by disappearance shatters real tracks (PHASE4 D3 / §2.1).

DROP TABLE IF EXISTS flight_events;
DROP TABLE IF EXISTS flights;

CREATE TABLE IF NOT EXISTS track_hours (
  icao24      TEXT        NOT NULL,
  hour_start  TIMESTAMPTZ NOT NULL,

  -- Bounding box of this hour's points, for coarse region filtering.
  min_lat REAL NOT NULL, max_lat REAL NOT NULL,
  min_lon REAL NOT NULL, max_lon REAL NOT NULL,

  point_count INT NOT NULL,

  -- Seconds since hour_start (0..3599). NEVER epoch seconds: REAL cannot
  -- represent those to better than ~3100 s, which silently corrupts replay.
  t_off REAL[] NOT NULL,
  lats  REAL[] NOT NULL,
  lons  REAL[] NOT NULL,
  alts  REAL[],

  PRIMARY KEY (icao24, hour_start)
);

CREATE INDEX IF NOT EXISTS track_hours_time_idx ON track_hours (hour_start);
CREATE INDEX IF NOT EXISTS track_hours_box_idx  ON track_hours
  USING GIST (box(point(min_lon, min_lat), point(max_lon, max_lat)));

-- Inferred flight sessions. Derived, not observed: see PHASE4 D3.
CREATE TABLE IF NOT EXISTS flight_sessions (
  id          BIGSERIAL PRIMARY KEY,
  icao24      TEXT        NOT NULL,
  callsign    TEXT,
  started_at  TIMESTAMPTZ NOT NULL,
  ended_at    TIMESTAMPTZ,
  point_count INT NOT NULL DEFAULT 0,
  min_lat REAL, max_lat REAL, min_lon REAL, max_lon REAL
);

CREATE INDEX IF NOT EXISTS flight_sessions_ac_idx
  ON flight_sessions (icao24, started_at DESC);
CREATE INDEX IF NOT EXISTS flight_sessions_time_idx
  ON flight_sessions (started_at DESC);

COMMENT ON TABLE track_hours IS
  'Observed positions packed one row per aircraft-hour. Trimmed to HISTORY_RETENTION_DAYS by ingestion.';
COMMENT ON TABLE flight_sessions IS
  'Inferred (icao24, callsign) sessions with gap tolerance. Derived, not observed.';
