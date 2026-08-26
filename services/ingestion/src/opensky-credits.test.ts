import { describe, expect, it } from "vitest";
import {
  boundingBoxAreaSqDeg,
  minPollIntervalMs,
  resolvePollIntervalMs,
  statesAllCreditCost,
} from "./opensky-credits";

describe("statesAllCreditCost", () => {
  it("costs 4 credits with no bounds (global snapshot)", () => {
    expect(statesAllCreditCost(undefined)).toBe(4);
  });

  it("costs 1 credit for a small bbox (<=25 sq deg)", () => {
    expect(statesAllCreditCost({ west: 0, south: 0, east: 5, north: 5 })).toBe(1);
  });

  it("costs 2 credits for a mid bbox (<=100 sq deg)", () => {
    expect(statesAllCreditCost({ west: 0, south: 0, east: 10, north: 10 })).toBe(2);
  });

  it("costs 3 credits for a larger bbox (<=400 sq deg)", () => {
    expect(statesAllCreditCost({ west: 0, south: 0, east: 20, north: 20 })).toBe(3);
  });

  it("costs 4 credits once the bbox exceeds 400 sq deg", () => {
    expect(statesAllCreditCost({ west: 0, south: 0, east: 30, north: 30 })).toBe(4);
  });

  it("is exact at the 25 sq deg boundary (1 credit, not 2)", () => {
    expect(statesAllCreditCost({ west: 0, south: 0, east: 5, north: 5 })).toBe(1);
  });
});

describe("boundingBoxAreaSqDeg", () => {
  it("multiplies lat span by lon span for a normal box", () => {
    expect(boundingBoxAreaSqDeg({ west: -10, south: 35, east: 30, north: 60 })).toBeCloseTo(
      40 * 25,
    );
  });

  it("handles a box crossing the antimeridian (west > east)", () => {
    // 170..-170 spans 20 degrees of longitude, not a negative or huge span.
    const area = boundingBoxAreaSqDeg({ west: 170, south: 0, east: -170, north: 10 });
    expect(area).toBeCloseTo(10 * 20);
  });

  it("never returns a negative area for an inverted lat span", () => {
    expect(boundingBoxAreaSqDeg({ west: 0, south: 60, east: 10, north: 10 })).toBe(0);
  });
});

describe("minPollIntervalMs", () => {
  it("keeps a 4-credit global poll within a day at the standard 4000/day budget", () => {
    const intervalMs = minPollIntervalMs(4000, 4);
    // ~4000*0.95/4 = 950 polls/day -> a poll roughly every ~91s
    expect(intervalMs).toBeGreaterThanOrEqual(90_000);
    expect(intervalMs).toBeLessThan(95_000);
  });

  it("allows a faster poll for a cheaper (bbox) request", () => {
    const global = minPollIntervalMs(4000, 4);
    const bbox = minPollIntervalMs(4000, 1);
    expect(bbox).toBeLessThan(global);
  });

  it("never returns zero or negative even for a tiny budget", () => {
    expect(minPollIntervalMs(1, 4)).toBeGreaterThan(0);
  });
});

describe("resolvePollIntervalMs", () => {
  it("honors a requested interval slower than the credit floor", () => {
    expect(resolvePollIntervalMs(300_000, 4000, 4)).toBe(300_000);
  });

  it("clamps a requested interval faster than the credit budget allows", () => {
    const floor = minPollIntervalMs(4000, 4);
    expect(resolvePollIntervalMs(1_000, 4000, 4)).toBe(floor);
  });
});
