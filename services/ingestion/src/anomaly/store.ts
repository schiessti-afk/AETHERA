import { createClient } from "redis";
import type { Pool } from "pg";
import type { Anomaly } from "@aethera/types";

type RedisClient = ReturnType<typeof createClient>;

export const ANOMALY_KEYS = {
  /** State conditions currently open, keyed `${icao24}:${TYPE}`. */
  active: "anomalies:active",
  /** `${icao24}:${TYPE}` -> ISO time of last detection, for the re-announce cooldown. */
  cooldown: "anomalies:cooldown",
  /** id -> full anomaly JSON, for everything inside the feed retention window. */
  store: "anomalies:store",
  /** id scored by detection time, so the feed can be trimmed and read newest-first. */
  recent: "anomalies:recent",
  /** icao24 scored by watch expiry — the scope for LOST_SIGNAL (see D3). */
  watched: "aircraft:watched",
} as const;

/**
 * How long a detection stays in the feed after it is raised.
 *
 * This exists because of the poll cadence, not as a preference: at ~90s, extreme
 * vertical rates almost never persist to the next snapshot, so a kinematic detection
 * is resolved within one cycle of being raised. Without a retention window the feed
 * would empty faster than anyone could read it, which PRODUCT_SPEC §18.4 forbids
 * ("resolved alerts should not vanish so quickly that the user cannot inspect them").
 */
export const FEED_RETENTION_MS = 15 * 60_000;

/** A recent-feed entry keyed for storage. */
function feedId(anomaly: Anomaly): string {
  // State conditions dedupe on `${icao24}:${TYPE}` so an open condition keeps one feed
  // row that flips to resolved. Events are distinct occurrences and keep their own row.
  return anomaly.kind === "state"
    ? anomaly.id
    : `${anomaly.id}@${Date.parse(anomaly.detectedAt)}`;
}

export class AnomalyStore {
  constructor(
    private readonly redis: RedisClient,
    private readonly pool: Pool | null,
  ) {}

  /** Restores the previous cycle's engine state. */
  async loadState(): Promise<{
    active: Record<string, Anomaly>;
    lastDetected: Record<string, string>;
    watched: string[];
  }> {
    const now = Date.now();
    // Drop expired watches before reading, so a client that went away stops
    // holding LOST_SIGNAL scope open.
    await this.redis.zRemRangeByScore(ANOMALY_KEYS.watched, 0, now);

    const [activeRaw, cooldownRaw, watched] = await Promise.all([
      this.redis.hGetAll(ANOMALY_KEYS.active),
      this.redis.hGetAll(ANOMALY_KEYS.cooldown),
      this.redis.zRange(ANOMALY_KEYS.watched, 0, -1),
    ]);

    const active: Record<string, Anomaly> = {};
    for (const [key, value] of Object.entries(activeRaw)) {
      try {
        active[key] = JSON.parse(value) as Anomaly;
      } catch {
        // drop unreadable entries rather than crashing the poll
      }
    }

    return { active, lastDetected: cooldownRaw, watched };
  }

  /** Writes the next cycle's engine state and the feed entries for this cycle. */
  async commit(params: {
    active: Record<string, Anomaly>;
    lastDetected: Record<string, string>;
    detected: Anomaly[];
    resolved: Anomaly[];
  }): Promise<void> {
    const now = Date.now();
    const pipeline = this.redis.multi();

    pipeline.del(ANOMALY_KEYS.active);
    for (const [key, anomaly] of Object.entries(params.active)) {
      pipeline.hSet(ANOMALY_KEYS.active, key, JSON.stringify(anomaly));
    }

    pipeline.del(ANOMALY_KEYS.cooldown);
    for (const [key, at] of Object.entries(params.lastDetected)) {
      pipeline.hSet(ANOMALY_KEYS.cooldown, key, at);
    }

    for (const anomaly of [...params.detected, ...params.resolved]) {
      const id = feedId(anomaly);
      pipeline.hSet(ANOMALY_KEYS.store, id, JSON.stringify(anomaly));
      pipeline.zAdd(ANOMALY_KEYS.recent, {
        score: Date.parse(anomaly.detectedAt),
        value: id,
      });
    }

    await pipeline.exec();
    await this.trimFeed(now);
    await this.persist(params.detected, params.resolved);
  }

  /** Drops feed entries older than the retention window from both the index and the store. */
  private async trimFeed(now: number): Promise<void> {
    const cutoff = now - FEED_RETENTION_MS;
    const expired = await this.redis.zRangeByScore(ANOMALY_KEYS.recent, 0, cutoff);
    if (expired.length === 0) return;

    const pipeline = this.redis.multi();
    pipeline.zRemRangeByScore(ANOMALY_KEYS.recent, 0, cutoff);
    for (const id of expired) pipeline.hDel(ANOMALY_KEYS.store, id);
    await pipeline.exec();
  }

  /**
   * Durable history. PostgreSQL keeps the events, never the per-poll position stream
   * (ARCHITECTURE §18). Failures here are logged and swallowed: losing a history row
   * must not take down live ingestion.
   */
  private async persist(detected: Anomaly[], resolved: Anomaly[]): Promise<void> {
    if (!this.pool) return;

    try {
      for (const anomaly of detected) {
        await this.pool.query(
          `INSERT INTO anomalies (icao24, type, kind, severity, value, detected_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            anomaly.icao24,
            anomaly.type,
            anomaly.kind,
            anomaly.severity,
            String(anomaly.value),
            anomaly.detectedAt,
          ],
        );
      }

      for (const anomaly of resolved) {
        // Close the most recent still-open row for this aircraft and condition.
        await this.pool.query(
          `UPDATE anomalies SET resolved_at = $1
           WHERE id = (
             SELECT id FROM anomalies
             WHERE icao24 = $2 AND type = $3 AND kind = 'state' AND resolved_at IS NULL
             ORDER BY detected_at DESC LIMIT 1
           )`,
          [anomaly.resolvedAt, anomaly.icao24, anomaly.type],
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ingestion: anomaly persistence failed: ${message}`);
    }
  }
}
