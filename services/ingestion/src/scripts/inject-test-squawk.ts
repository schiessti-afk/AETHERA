/**
 * Injects a synthetic emergency squawk into the live Redis state, for testing.
 *
 * The highest-severity path in the product — 7500/7600/7700 detection, the critical
 * marker, the alert feed's most important row — can otherwise only be exercised by
 * waiting for a real aircraft to squawk one. That makes the code most worth trusting
 * the code least often tested.
 *
 * It works by parking a request in Redis that ingestion applies to the *provider
 * snapshot* on its next poll, immediately before detection runs. That matters: the
 * detector reads the incoming snapshot, not the stored state, so writing a squawk
 * straight into `flights:state` would be overwritten and never detected. Going through
 * the snapshot means the real detection, persistence, broadcast and resolution paths
 * are all exercised rather than mocked.
 *
 * The request is consumed after one cycle, so the condition resolves on the following
 * poll — which exercises the resolution path too.
 *
 * Usage:
 *   pnpm --filter @aethera/ingestion inject:squawk            # random aircraft, 7700
 *   pnpm --filter @aethera/ingestion inject:squawk 7500       # specific code
 *   pnpm --filter @aethera/ingestion inject:squawk 7600 abc123
 */
import { createClient } from "redis";
import type { FlightState } from "@aethera/types";
import { config } from "../config";
import { KEYS, TEST_INJECT_KEY } from "../publisher/redis";

const VALID = new Set(["7500", "7600", "7700"]);

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("refusing to inject synthetic state in production");
  }

  const squawk = process.argv[2] ?? "7700";
  if (!VALID.has(squawk)) {
    throw new Error(`squawk must be one of ${[...VALID].join(", ")}`);
  }
  const requested = process.argv[3]?.toLowerCase();

  const redis = createClient({ url: config.redisUrl });
  await redis.connect();

  const raw = await redis.hGetAll(KEYS.state);
  const entries = Object.entries(raw);
  if (entries.length === 0) {
    throw new Error("no live aircraft in Redis — is ingestion running?");
  }

  let target: [string, string] | undefined;
  if (requested) {
    target = entries.find(([icao24]) => icao24 === requested);
    if (!target) throw new Error(`aircraft ${requested} is not currently observed`);
  } else {
    // Prefer an airborne aircraft with a callsign so the alert row reads naturally.
    const airborne = entries.filter(([, value]) => {
      try {
        const state = JSON.parse(value) as FlightState;
        return !state.onGround && state.callsign;
      } catch {
        return false;
      }
    });
    const pool = airborne.length > 0 ? airborne : entries;
    target = pool[Math.floor(Math.random() * pool.length)];
  }

  const [icao24, value] = target;
  const state = JSON.parse(value) as FlightState;

  await redis.set(TEST_INJECT_KEY, JSON.stringify({ icao24, squawk }), { EX: 600 });
  await redis.quit();

  console.log(
    `queued squawk ${squawk} for ${icao24}` +
      (state.callsign ? ` (${state.callsign})` : "") +
      `\nIngestion applies it to the next poll's snapshot, so it should appear in the` +
      `\nalert feed within one poll interval and resolve on the following one.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
