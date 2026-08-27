-- Natural key for inferred sessions so later polls can upsert instead of
-- inserting a new row for the same (icao24, started_at) opening.
CREATE UNIQUE INDEX IF NOT EXISTS flight_sessions_icao_started_uk
  ON flight_sessions (icao24, started_at);
