import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import type { BoundingBox } from "@aethera/types";
import { resolvePollIntervalMs, statesAllCreditCost } from "./opensky-credits";

loadEnv({ path: resolve(__dirname, "../../../.env") });

function readBounds(): BoundingBox | undefined {
  const west = process.env.OPENSKY_WEST;
  const south = process.env.OPENSKY_SOUTH;
  const east = process.env.OPENSKY_EAST;
  const north = process.env.OPENSKY_NORTH;
  if (west == null || south == null || east == null || north == null) {
    return undefined;
  }
  return {
    west: Number(west),
    south: Number(south),
    east: Number(east),
    north: Number(north),
  };
}

const requestedPollIntervalMs = Number(process.env.OPENSKY_POLL_INTERVAL_MS ?? 90_000);
const dailyCredits = Number(process.env.OPENSKY_DAILY_CREDITS ?? 4_000);
const bounds = readBounds();
const creditCost = statesAllCreditCost(bounds);

export const config = {
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6380",
  openskyClientId: (process.env.OPENSKY_CLIENT_ID ?? "").trim(),
  openskyClientSecret: (process.env.OPENSKY_CLIENT_SECRET ?? "").trim(),
  dailyCredits,
  bounds,
  creditCost,
  pollIntervalMs: resolvePollIntervalMs(requestedPollIntervalMs, dailyCredits, creditCost),
  staleAfterMs: Number(process.env.STALE_AFTER_MS ?? 300_000),
};
