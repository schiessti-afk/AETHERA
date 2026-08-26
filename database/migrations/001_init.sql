-- AETHERA persistent schema
-- Live aircraft positions stay in Redis. PostgreSQL stores durable records.

CREATE TABLE IF NOT EXISTS aircraft (
  icao24 TEXT PRIMARY KEY,
  registration TEXT,
  type_code TEXT,
  operator TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS airports (
  icao TEXT PRIMARY KEY,
  iata TEXT,
  name TEXT NOT NULL,
  city TEXT,
  country TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  elevation_m DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icao24 TEXT NOT NULL,
  callsign TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  origin_icao TEXT,
  destination_icao TEXT
);

CREATE INDEX IF NOT EXISTS flights_icao24_idx ON flights (icao24);
CREATE INDEX IF NOT EXISTS flights_started_at_idx ON flights (started_at DESC);

CREATE TABLE IF NOT EXISTS flight_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id UUID REFERENCES flights (id) ON DELETE SET NULL,
  icao24 TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flight_events_icao24_idx ON flight_events (icao24);
CREATE INDEX IF NOT EXISTS flight_events_occurred_at_idx ON flight_events (occurred_at DESC);

CREATE TABLE IF NOT EXISTS anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icao24 TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  value TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS anomalies_detected_at_idx ON anomalies (detected_at DESC);

CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);
