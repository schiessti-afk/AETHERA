import { createClient } from "redis";
import type { Anomaly, FlightState, RealtimeEvent } from "@aethera/types";

type RedisClient = ReturnType<typeof createClient>;

export const KEYS = {
  state: "flights:state",
  active: "flights:active",
  meta: "ingestion:meta",
  events: "aethera:events",
} as const;

/**
 * Development-only hook for exercising the emergency-squawk path on demand.
 * See scripts/inject-test-squawk.ts. Never read when NODE_ENV is production.
 */
export const TEST_INJECT_KEY = "test:inject:squawk";

/** Per-aircraft recent path, capped and expiring. `trail:{icao24}`. */
export const trailKey = (icao24: string) => `trail:${icao24}`;

/**
 * Points kept per aircraft. At a ~90s poll this is a little over two hours of path,
 * which is more than enough for the "recent movement" a trail is meant to show
 * (PRODUCT_SPEC §14.1) without turning Redis into a track archive — durable history is
 * Phase 4's job, in PostgreSQL.
 */
const TRAIL_MAX_POINTS = 90;
/** Trails for aircraft that stop being observed expire on their own. */
const TRAIL_TTL_SECONDS = 2 * 60 * 60;

export class RedisPublisher {
  constructor(
    private readonly redis: RedisClient,
    private readonly staleAfterMs: number,
  ) {}

  /**
   * Merges a new snapshot into the live store instead of wiping it every poll.
   * An aircraft absent from this cycle is kept (as a candidate for client-side
   * staleness/interpolation) until it hasn't been seen for `staleAfterMs`, then evicted.
   */
  async mergeSnapshot(
    states: FlightState[],
    sourceTime: string,
    creditsRemaining?: number,
  ): Promise<{ previous: FlightState[] }> {
    const existingRaw = await this.redis.hGetAll(KEYS.state);
    const now = Date.now();
    const seen = new Set(states.map((state) => state.icao24));

    // The state we are about to replace. Returned so anomaly detection can compare
    // against it — disappearance is only meaningful relative to a known previous state.
    const previous: FlightState[] = [];
    for (const raw of Object.values(existingRaw)) {
      try {
        previous.push(JSON.parse(raw) as FlightState);
      } catch {
        // skip unreadable entries
      }
    }

    // An aircraft absent this cycle survives until it's older than staleAfterMs,
    // so the client can show it as stale rather than have it vanish instantly.
    const carried = Object.entries(existingRaw).filter(([icao24, raw]) => {
      if (seen.has(icao24)) return false;
      try {
        const age = now - Date.parse((JSON.parse(raw) as FlightState).lastSeen);
        return Number.isFinite(age) && age <= this.staleAfterMs;
      } catch {
        return false;
      }
    });

    const finalKeys = new Set([...seen, ...carried.map(([icao24]) => icao24)]);

    const pipeline = this.redis.multi();
    pipeline.del(KEYS.state);
    pipeline.del(KEYS.active);

    for (const state of states) {
      pipeline.hSet(KEYS.state, state.icao24, JSON.stringify(state));
    }
    for (const [icao24, raw] of carried) {
      pipeline.hSet(KEYS.state, icao24, raw);
    }
    for (const icao24 of finalKeys) {
      pipeline.sAdd(KEYS.active, icao24);
    }

    // Record the observed path for every aircraft, so a trail is available immediately
    // on selection rather than only accumulating from the moment a user clicks. Only
    // genuinely observed positions go in — never interpolated ones, which would put
    // estimated positions into what reads as a record of where the aircraft was.
    const previousSeen = new Map(previous.map((f) => [f.icao24, f.lastSeen]));
    for (const state of states) {
      // A repeated lastSeen means the source had nothing new for this aircraft; appending
      // it again would inflate the trail with duplicate points at one position.
      if (previousSeen.get(state.icao24) === state.lastSeen) continue;

      const key = trailKey(state.icao24);
      pipeline.rPush(
        key,
        `${state.longitude.toFixed(5)},${state.latitude.toFixed(5)},${
          state.altitude != null ? Math.round(state.altitude) : ""
        },${Date.parse(state.lastSeen)}`,
      );
      pipeline.lTrim(key, -TRAIL_MAX_POINTS, -1);
      pipeline.expire(key, TRAIL_TTL_SECONDS);
    }

    pipeline.hSet(KEYS.meta, "lastSuccessAt", new Date().toISOString());
    pipeline.hSet(KEYS.meta, "sourceTime", sourceTime);
    pipeline.hSet(KEYS.meta, "aircraftCount", String(states.length));
    pipeline.hSet(KEYS.meta, "observedCount", String(finalKeys.size));
    pipeline.hSet(KEYS.meta, "lastError", "");
    if (creditsRemaining != null) {
      pipeline.hSet(KEYS.meta, "creditsRemaining", String(creditsRemaining));
    }

    await pipeline.exec();

    const event: RealtimeEvent<{ count: number }> = {
      type: "flight.updated",
      timestamp: new Date().toISOString(),
      data: { count: states.length },
    };
    await this.redis.publish(KEYS.events, JSON.stringify(event));

    return { previous };
  }

  /** Broadcasts anomaly lifecycle events on the shared channel (ARCHITECTURE §17). */
  async publishAnomalies(detected: Anomaly[], resolved: Anomaly[]): Promise<void> {
    const timestamp = new Date().toISOString();
    for (const anomaly of detected) {
      const event: RealtimeEvent<Anomaly> = {
        type: "anomaly.detected",
        timestamp,
        data: anomaly,
      };
      await this.redis.publish(KEYS.events, JSON.stringify(event));
    }
    for (const anomaly of resolved) {
      const event: RealtimeEvent<Anomaly> = {
        type: "anomaly.resolved",
        timestamp,
        data: anomaly,
      };
      await this.redis.publish(KEYS.events, JSON.stringify(event));
    }
  }

  /** Reads and clears a queued synthetic squawk request (development only). */
  async takeTestInjection(): Promise<{ icao24: string; squawk: string } | null> {
    const raw = await this.redis.get(TEST_INJECT_KEY);
    if (!raw) return null;
    await this.redis.del(TEST_INJECT_KEY);
    try {
      return JSON.parse(raw) as { icao24: string; squawk: string };
    } catch {
      return null;
    }
  }

  async recordFailure(error: string): Promise<void> {
    await this.redis.hSet(KEYS.meta, "lastError", error);
    await this.redis.hSet(KEYS.meta, "lastFailureAt", new Date().toISOString());
  }
}
