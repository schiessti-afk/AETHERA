import { createClient } from "redis";
import type { FlightState, RealtimeEvent } from "@aethera/types";

type RedisClient = ReturnType<typeof createClient>;

export const KEYS = {
  state: "flights:state",
  active: "flights:active",
  meta: "ingestion:meta",
  events: "aethera:events",
} as const;

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
  ): Promise<void> {
    const existingRaw = await this.redis.hGetAll(KEYS.state);
    const now = Date.now();
    const seen = new Set(states.map((state) => state.icao24));

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
  }

  async recordFailure(error: string): Promise<void> {
    await this.redis.hSet(KEYS.meta, "lastError", error);
    await this.redis.hSet(KEYS.meta, "lastFailureAt", new Date().toISOString());
  }
}
