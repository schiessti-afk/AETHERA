import type { Pool } from "pg";
import type { RedisClient } from "../publisher/redis";
import {
  packByHour,
  utcHourStartMs,
  type ObservedTrackPoint,
  type PackedHour,
} from "@aethera/flight-engine";

const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_FLUSH_INTERVAL_MS = 5 * 60_000;
const PRUNE_INTERVAL_MS = 60 * 60_000;

function parseTrailEntry(icao24: string, entry: string): ObservedTrackPoint | null {
  const [lon, lat, alt, ts] = entry.split(",");
  const longitude = Number(lon);
  const latitude = Number(lat);
  const timeMs = Number(ts);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !Number.isFinite(timeMs)) {
    return null;
  }
  return {
    icao24,
    timeMs,
    latitude,
    longitude,
    altitude: alt === "" || alt == null ? null : Number(alt),
  };
}

/**
 * Promotes completed aircraft-hours from Redis trails into packed PostgreSQL rows.
 * Only observed positions are stored — trails never contain interpolated points.
 */
export class TrackFlusher {
  private lastFlush = 0;
  private lastPrune = 0;
  private busy = false;
  private readonly retentionDays: number;
  private readonly flushIntervalMs: number;

  constructor(
    private readonly redis: RedisClient,
    private readonly pool: Pool | null,
  ) {
    this.retentionDays = Number(process.env.HISTORY_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS);
    this.flushIntervalMs = Number(
      process.env.HISTORY_FLUSH_INTERVAL_MS ?? DEFAULT_FLUSH_INTERVAL_MS,
    );
  }

  async maybeFlush(now = Date.now()): Promise<void> {
    if (!this.pool || this.busy) return;
    if (now - this.lastFlush < this.flushIntervalMs && this.lastFlush !== 0) return;
    this.busy = true;

    try {
      const points = await this.readCompletedPoints(now);
      const packed = packByHour(points);
      const rows = await this.upsertHours(packed);
      this.lastFlush = now;
      await this.recordFlush(now, rows, null);
      if (rows > 0) {
        console.log(`ingestion: flushed ${rows} track hours`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ingestion: track flush failed: ${message}`);
      await this.recordFlush(now, 0, message);
    } finally {
      this.busy = false;
    }

    await this.prune(now);
  }

  private async readCompletedPoints(now: number): Promise<ObservedTrackPoint[]> {
    const currentHour = utcHourStartMs(now);
    const points: ObservedTrackPoint[] = [];
    let cursor = 0;

    do {
      const result = await this.redis.scan(cursor, { MATCH: "trail:*", COUNT: 500 });
      cursor = Number(result.cursor);
      const keys = result.keys;
      for (let i = 0; i < keys.length; i += 100) {
        const batch = keys.slice(i, i + 100);
        const pipeline = this.redis.multi();
        for (const key of batch) pipeline.lRange(key, 0, -1);
        const replies = await pipeline.exec();
        for (let j = 0; j < batch.length; j++) {
          const icao24 = batch[j].slice("trail:".length);
          const raw = (replies?.[j] as string[] | undefined) ?? [];
          for (const entry of raw) {
            const point = parseTrailEntry(icao24, entry);
            if (!point) continue;
            if (utcHourStartMs(point.timeMs) >= currentHour) continue;
            points.push(point);
          }
        }
      }
    } while (cursor !== 0);

    return points;
  }

  private async upsertHours(hours: PackedHour[]): Promise<number> {
    if (!this.pool || hours.length === 0) return 0;

    let written = 0;
    const chunkSize = 40;
    for (let i = 0; i < hours.length; i += chunkSize) {
      const chunk = hours.slice(i, i + chunkSize);
      const values: string[] = [];
      const params: unknown[] = [];
      for (const hour of chunk) {
        const o = params.length;
        values.push(
          `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}, $${o + 10}, $${o + 11})`,
        );
        params.push(
          hour.icao24,
          new Date(hour.hourStartMs).toISOString(),
          hour.minLat,
          hour.maxLat,
          hour.minLon,
          hour.maxLon,
          hour.pointCount,
          hour.tOff,
          hour.lats,
          hour.lons,
          hour.alts,
        );
      }
      const result = await this.pool.query(
        `INSERT INTO track_hours
           (icao24, hour_start, min_lat, max_lat, min_lon, max_lon, point_count, t_off, lats, lons, alts)
         VALUES ${values.join(",")}
         ON CONFLICT (icao24, hour_start) DO UPDATE SET
           min_lat     = LEAST(track_hours.min_lat, EXCLUDED.min_lat),
           max_lat     = GREATEST(track_hours.max_lat, EXCLUDED.max_lat),
           min_lon     = LEAST(track_hours.min_lon, EXCLUDED.min_lon),
           max_lon     = GREATEST(track_hours.max_lon, EXCLUDED.max_lon),
           point_count = EXCLUDED.point_count,
           t_off       = EXCLUDED.t_off,
           lats        = EXCLUDED.lats,
           lons        = EXCLUDED.lons,
           alts        = EXCLUDED.alts
         WHERE EXCLUDED.point_count > track_hours.point_count`,
        params,
      );
      written += result.rowCount ?? 0;
    }
    return written;
  }

  private async recordFlush(now: number, rows: number, error: string | null): Promise<void> {
    try {
      await this.redis.hSet("ingestion:meta", {
        historyLastFlushAt: new Date(now).toISOString(),
        historyLastFlushRows: String(rows),
        historyLastFlushError: error ?? "",
        historyRetentionDays: String(this.retentionDays),
      });
    } catch {
      // health metadata is best-effort
    }
  }

  private async prune(now: number): Promise<void> {
    if (!this.pool) return;
    if (now - this.lastPrune < PRUNE_INTERVAL_MS && this.lastPrune !== 0) return;
    this.lastPrune = now;

    try {
      const tracks = await this.pool.query(
        `DELETE FROM track_hours
          WHERE hour_start < now() - ($1 || ' days')::interval`,
        [String(this.retentionDays)],
      );
      const sessions = await this.pool.query(
        `DELETE FROM flight_sessions
          WHERE started_at < now() - ($1 || ' days')::interval`,
        [String(this.retentionDays)],
      );
      const dropped = (tracks.rowCount ?? 0) + (sessions.rowCount ?? 0);
      if (dropped > 0) {
        console.log(`ingestion: pruned ${dropped} history rows`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ingestion: history prune failed: ${message}`);
    }
  }
}
