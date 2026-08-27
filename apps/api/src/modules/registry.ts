import type { RegistryEntry } from "@aethera/types";
import { pool } from "./postgres";
import { liveAircraft, liveStamp } from "./snapshot";

/**
 * In-memory join of Phase 2 registry rows onto the current live icao24 set.
 *
 * The full OpenSky dump is hundreds of thousands of rows; only the aircraft
 * actually on the map need typecode/registration for spotter colouring and
 * wildcard search. Cached against the same ingestion stamp as the snapshot
 * so a poll refresh is the only thing that rebuilds it.
 */
class RegistryIndex {
  private stamp: string | null = null;
  private ready = false;
  private map = new Map<string, RegistryEntry>();
  private inFlight: Promise<Map<string, RegistryEntry>> | null = null;

  async get(): Promise<Map<string, RegistryEntry>> {
    const flights = await liveAircraft();
    const stamp = liveStamp();
    if (this.ready && stamp === this.stamp) return this.map;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.load(flights.map((flight) => flight.icao24), stamp);
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async load(
    icao24s: string[],
    stamp: string | null,
  ): Promise<Map<string, RegistryEntry>> {
    if (icao24s.length === 0) {
      this.map = new Map();
      this.stamp = stamp;
      this.ready = true;
      return this.map;
    }

    try {
      const result = await pool.query<{
        icao24: string;
        typeCode: string | null;
        registration: string | null;
      }>(
        `SELECT icao24, type_code AS "typeCode", registration
           FROM aircraft
          WHERE icao24 = ANY($1::text[])`,
        [icao24s],
      );

      const next = new Map<string, RegistryEntry>();
      for (const row of result.rows) {
        const typeCode = row.typeCode?.trim() || null;
        const registration = row.registration?.trim() || null;
        if (!typeCode && !registration) continue;
        next.set(row.icao24, { typeCode, registration });
      }
      this.map = next;
      this.stamp = stamp;
      this.ready = true;
      return this.map;
    } catch {
      // Registry is optional. Keep whatever we last built so colouring does
      // not blink off because Postgres blipped.
      return this.map;
    }
  }
}

const index = new RegistryIndex();

export function liveRegistry(): Promise<Map<string, RegistryEntry>> {
  return index.get();
}
