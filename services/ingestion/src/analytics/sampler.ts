import type { Pool } from "pg";
import type { FlightState } from "@aethera/types";
import { summariseAirspace } from "@aethera/flight-engine";

/**
 * Writes one aggregate row per poll so Analytics has a time axis to plot.
 *
 * Aggregates only: counts and band histograms, never per-aircraft positions. That keeps
 * the rule that PostgreSQL is not the high-frequency state store (ARCHITECTURE §18)
 * while still leaving something real behind — at a ~90s poll this is about 960 small
 * rows a day, which is a rounding error next to storing the position stream.
 */
/** How long aggregates are kept. Analytics never reads beyond 24 hours. */
const DEFAULT_RETENTION_HOURS = 48;
/** Trimming every poll would be wasteful; once an hour is ample for a 960/day table. */
const PRUNE_INTERVAL_MS = 60 * 60_000;

export class AirspaceSampler {
  private lastPrune = 0;
  private readonly retentionHours: number;

  constructor(private readonly pool: Pool | null) {
    this.retentionHours = Number(
      process.env.ANALYTICS_RETENTION_HOURS ?? DEFAULT_RETENTION_HOURS,
    );
  }

  async record(flights: FlightState[], activeAnomalies: number): Promise<void> {
    if (!this.pool) return;

    const sample = summariseAirspace(flights, { activeAnomalies });

    try {
      await this.pool.query(
        `INSERT INTO airspace_samples
           (observed_at, observed, airborne, on_ground, climbing, descending, level,
            altitude_bands, speed_bands, active_anomalies)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          sample.observedAt,
          sample.observed,
          sample.airborne,
          sample.onGround,
          sample.climbing,
          sample.descending,
          sample.level,
          JSON.stringify(sample.altitudeBands),
          JSON.stringify(sample.speedBands),
          sample.activeAnomalies,
        ],
      );
    } catch (error) {
      // Losing a statistics row must never cost us the live picture.
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ingestion: airspace sample failed: ${message}`);
    }

    await this.prune();
  }

  /** Drops aggregates past the retention window so the table cannot grow unbounded. */
  private async prune(): Promise<void> {
    if (!this.pool) return;

    const now = Date.now();
    if (now - this.lastPrune < PRUNE_INTERVAL_MS) return;
    this.lastPrune = now;

    try {
      const result = await this.pool.query(
        `DELETE FROM airspace_samples
          WHERE observed_at < now() - ($1 || ' hours')::interval`,
        [String(this.retentionHours)],
      );
      if (result.rowCount) {
        console.log(`ingestion: pruned ${result.rowCount} airspace samples`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ingestion: airspace prune failed: ${message}`);
    }
  }
}
