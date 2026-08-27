import type { FlightState } from "@aethera/types";
import { KEYS, type RedisClient } from "./redis";

/**
 * Parsed view of the live aircraft hash, shared across requests.
 *
 * Every read endpoint — stats, analytics, airport traffic, search — needs the
 * same ~10,000 aircraft, and each was independently doing `hGetAll` plus 10,000
 * `JSON.parse` calls. The underlying data only changes once per ingestion poll (~90s),
 * so that work was being repeated for no benefit.
 *
 * The cache is keyed on ingestion's own `lastSuccessAt` rather than a time-to-live, so
 * it invalidates exactly when new data lands instead of guessing an interval: a request
 * never sees a snapshot older than the one ingestion has published.
 */
class SnapshotCache {
  private key: string | null = null;
  private flights: FlightState[] = [];
  private inFlight: Promise<FlightState[]> | null = null;

  constructor(private readonly redis: RedisClient) {}

  async get(): Promise<FlightState[]> {
    const stamp = await this.currentStamp();
    if (stamp !== null && stamp === this.key) return this.flights;

    // Collapse concurrent misses so a burst of requests after a poll does not each
    // pay for the same parse.
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.load(stamp);
    try {
      return await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }

  private async currentStamp(): Promise<string | null> {
    try {
      return (await this.redis.hGet(KEYS.meta, "lastSuccessAt")) ?? null;
    } catch {
      return null;
    }
  }

  private async load(stamp: string | null): Promise<FlightState[]> {
    const raw = await this.redis.hGetAll(KEYS.state);
    const flights: FlightState[] = [];
    for (const value of Object.values(raw)) {
      try {
        flights.push(JSON.parse(value) as FlightState);
      } catch {
        // skip malformed entries
      }
    }

    this.flights = flights;
    this.key = stamp;
    return flights;
  }

  currentKey(): string | null {
    return this.key;
  }
}

let cache: SnapshotCache | null = null;

export function createSnapshotCache(redis: RedisClient): SnapshotCache {
  cache = new SnapshotCache(redis);
  return cache;
}

/** The current observed aircraft, parsed once per ingestion poll. */
export function liveAircraft(): Promise<FlightState[]> {
  if (!cache) throw new Error("snapshot cache not initialised");
  return cache.get();
}

/** Ingestion stamp the current live snapshot was built from, or null. */
export function liveStamp(): string | null {
  if (!cache) throw new Error("snapshot cache not initialised");
  return cache.currentKey();
}
