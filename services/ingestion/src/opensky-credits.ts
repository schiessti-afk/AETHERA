import type { BoundingBox } from "@aethera/types";

const DAY_MS = 86_400_000;
const CREDIT_BUFFER = 0.95;

/** OpenSky `/states/all` cost from bounding-box area in square degrees. */
export function statesAllCreditCost(bounds?: BoundingBox): 1 | 2 | 3 | 4 {
  if (!bounds) return 4;
  const area = boundingBoxAreaSqDeg(bounds);
  if (area <= 25) return 1;
  if (area <= 100) return 2;
  if (area <= 400) return 3;
  return 4;
}

export function boundingBoxAreaSqDeg(bounds: BoundingBox): number {
  const latSpan = Math.max(0, bounds.north - bounds.south);
  const lonSpan =
    bounds.west <= bounds.east
      ? bounds.east - bounds.west
      : 360 - (bounds.west - bounds.east);
  return latSpan * lonSpan;
}

/** Slowest safe poll so `dailyCredits` lasts a full day at this per-request cost. */
export function minPollIntervalMs(dailyCredits: number, cost: number): number {
  const usable = Math.max(1, Math.floor(dailyCredits * CREDIT_BUFFER));
  const maxPolls = Math.max(1, Math.floor(usable / cost));
  return Math.ceil(DAY_MS / maxPolls);
}

export function resolvePollIntervalMs(
  requestedMs: number,
  dailyCredits: number,
  cost: number,
): number {
  return Math.max(requestedMs, minPollIntervalMs(dailyCredits, cost));
}
