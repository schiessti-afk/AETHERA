import type { Pool } from "pg";
import type { FlightState } from "@aethera/types";
import {
  applyObservation,
  observationsFromStates,
  DEFAULT_SESSION_GAP_MS,
  type OpenSession,
} from "./sessions";

interface SessionRow {
  id: string;
  icao24: string;
  callsign: string | null;
  started_at: Date;
  ended_at: Date | null;
  point_count: number;
  min_lat: number | null;
  max_lat: number | null;
  min_lon: number | null;
  max_lon: number | null;
}

function rowToSession(row: SessionRow): OpenSession {
  const startedAt = row.started_at.getTime();
  const endedAt = row.ended_at?.getTime() ?? startedAt;
  return {
    id: Number(row.id),
    icao24: row.icao24,
    callsign: row.callsign,
    startedAt,
    endedAt,
    pointCount: row.point_count,
    minLat: row.min_lat ?? 0,
    maxLat: row.max_lat ?? 0,
    minLon: row.min_lon ?? 0,
    maxLon: row.max_lon ?? 0,
    dirty: false,
    isNew: false,
  };
}

/**
 * Maintains inferred (icao24, callsign) sessions from live observations.
 * In-memory for the current process; persisted every poll via upsert.
 */
export class SessionTracker {
  private readonly open = new Map<string, OpenSession>();
  private readonly gapMs: number;
  private hydrated = false;

  constructor(
    private readonly pool: Pool | null,
    gapMinutes?: number,
  ) {
    this.gapMs = (gapMinutes ?? DEFAULT_SESSION_GAP_MS / 60_000) * 60_000;
  }

  async observe(states: FlightState[]): Promise<void> {
    if (!this.pool) return;

    try {
      await this.hydrate();
      const observations = observationsFromStates(states).filter((obs) =>
        Number.isFinite(obs.timeMs),
      );

      for (const obs of observations) {
        const current = this.open.get(obs.icao24);
        const { session } = applyObservation(current, obs, this.gapMs);
        this.open.set(obs.icao24, session);
      }

      await this.flush();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ingestion: session inference failed: ${message}`);
    }
  }

  private async hydrate(): Promise<void> {
    if (this.hydrated || !this.pool) return;
    this.hydrated = true;

    const result = await this.pool.query<SessionRow>(
      `SELECT DISTINCT ON (icao24)
              id, icao24, callsign, started_at, ended_at, point_count,
              min_lat, max_lat, min_lon, max_lon
         FROM flight_sessions
        WHERE ended_at > now() - ($1 || ' milliseconds')::interval
        ORDER BY icao24, started_at DESC`,
      [String(this.gapMs)],
    );

    for (const row of result.rows) {
      this.open.set(row.icao24, rowToSession(row));
    }
  }

  private async flush(): Promise<void> {
    if (!this.pool) return;

    const dirty = [...this.open.values()].filter((s) => s.dirty || s.isNew);
    if (dirty.length === 0) return;

    const result = await this.pool.query<{ id: string; icao24: string }>(
      `INSERT INTO flight_sessions
         (icao24, callsign, started_at, ended_at, point_count, min_lat, max_lat, min_lon, max_lon)
       SELECT * FROM unnest(
         $1::text[], $2::text[], $3::timestamptz[], $4::timestamptz[],
         $5::int[], $6::real[], $7::real[], $8::real[], $9::real[]
       )
       ON CONFLICT (icao24, started_at) DO UPDATE SET
         callsign    = EXCLUDED.callsign,
         ended_at    = EXCLUDED.ended_at,
         point_count = EXCLUDED.point_count,
         min_lat     = LEAST(flight_sessions.min_lat, EXCLUDED.min_lat),
         max_lat     = GREATEST(flight_sessions.max_lat, EXCLUDED.max_lat),
         min_lon     = LEAST(flight_sessions.min_lon, EXCLUDED.min_lon),
         max_lon     = GREATEST(flight_sessions.max_lon, EXCLUDED.max_lon)
       RETURNING id, icao24`,
      [
        dirty.map((s) => s.icao24),
        dirty.map((s) => s.callsign),
        dirty.map((s) => new Date(s.startedAt).toISOString()),
        dirty.map((s) => new Date(s.endedAt).toISOString()),
        dirty.map((s) => s.pointCount),
        dirty.map((s) => s.minLat),
        dirty.map((s) => s.maxLat),
        dirty.map((s) => s.minLon),
        dirty.map((s) => s.maxLon),
      ],
    );

    const ids = new Map(result.rows.map((row) => [row.icao24, Number(row.id)]));
    for (const session of dirty) {
      const id = ids.get(session.icao24);
      if (id != null) session.id = id;
      session.isNew = false;
      session.dirty = false;
    }
  }
}
