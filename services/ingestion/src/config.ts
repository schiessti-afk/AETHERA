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
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://aethera:aethera_password@localhost:55432/aethera",
  /** Days of packed track history to keep. 30 days is ~7.4 GB at current traffic. */
  historyRetentionDays: Number(process.env.HISTORY_RETENTION_DAYS ?? 30),
  /** Close an inferred session after this much silence. Generous: coverage gaps are common. */
  sessionGapMinutes: Number(process.env.HISTORY_SESSION_GAP_MINUTES ?? 120),
  /**
   * Detection thresholds — PRODUCT_SPEC §26.4 requires these to be tunable. Defaults
   * live in @aethera/anomaly-engine and were calibrated against real traffic; see the
   * comment on AnomalyThresholds there before changing them.
   */
  anomalyThresholds: {
    ...(process.env.ANOMALY_RAPID_DESCENT_FPM
      ? { rapidDescentFpm: Number(process.env.ANOMALY_RAPID_DESCENT_FPM) }
      : {}),
    ...(process.env.ANOMALY_RAPID_CLIMB_FPM
      ? { rapidClimbFpm: Number(process.env.ANOMALY_RAPID_CLIMB_FPM) }
      : {}),
    ...(process.env.ANOMALY_COOLDOWN_MS
      ? { cooldownMs: Number(process.env.ANOMALY_COOLDOWN_MS) }
      : {}),
  },
};
