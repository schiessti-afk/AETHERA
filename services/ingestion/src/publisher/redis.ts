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
  constructor(private readonly redis: RedisClient) {}

  async replaceSnapshot(
    states: FlightState[],
    sourceTime: string,
    creditsRemaining?: number,
  ): Promise<void> {
    const pipeline = this.redis.multi();
    pipeline.del(KEYS.state);
    pipeline.del(KEYS.active);

    for (const state of states) {
      pipeline.hSet(KEYS.state, state.icao24, JSON.stringify(state));
      pipeline.sAdd(KEYS.active, state.icao24);
    }

    pipeline.hSet(KEYS.meta, "lastSuccessAt", new Date().toISOString());
    pipeline.hSet(KEYS.meta, "sourceTime", sourceTime);
    pipeline.hSet(KEYS.meta, "aircraftCount", String(states.length));
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
