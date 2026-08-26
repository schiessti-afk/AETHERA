import { describe, expect, it } from "vitest";
import type { FlightState } from "@aethera/types";
import {
  FlightStore,
  REMOVE_AFTER_S,
  STALE_AFTER_S,
  dataAgeSeconds,
  interpolatePosition,
  markerFreshness,
  positionConfidence,
} from "./index";

function flight(overrides: Partial<FlightState> = {}): FlightState {
  const now = new Date().toISOString();
  return {
    icao24: "abc123",
    latitude: 48.8566,
    longitude: 2.3522,
    onGround: false,
    velocity: 200, // m/s
    heading: 90, // due east
    lastSeen: now,
    receivedAt: now,
    processedAt: now,
    ...overrides,
  };
}

describe("interpolatePosition", () => {
  it("does not move a grounded aircraft", () => {
    const state = flight({ onGround: true, lastSeen: new Date(Date.now() - 30_000).toISOString() });
    const result = interpolatePosition(state);
    expect(result.interpolated).toBe(false);
    expect(result.longitude).toBe(state.longitude);
  });

  it("does not move an aircraft with no velocity or heading", () => {
    const state = flight({ velocity: undefined, heading: undefined });
    const result = interpolatePosition(state);
    expect(result.interpolated).toBe(false);
  });

  it("does not extrapolate backwards for a future lastSeen (clock skew)", () => {
    const state = flight({ lastSeen: new Date(Date.now() + 5_000).toISOString() });
    const result = interpolatePosition(state);
    expect(result.interpolated).toBe(false);
    expect(result.longitude).toBe(state.longitude);
  });

  it("moves an airborne aircraft east when heading is 90 degrees", () => {
    const lastSeen = new Date(Date.now() - 10_000).toISOString();
    const state = flight({ heading: 90, lastSeen });
    const result = interpolatePosition(state);
    expect(result.interpolated).toBe(true);
    expect(result.longitude).toBeGreaterThan(state.longitude);
    expect(result.latitude).toBeCloseTo(state.latitude, 3);
  });

  it("moves an airborne aircraft north when heading is 0 degrees", () => {
    const lastSeen = new Date(Date.now() - 10_000).toISOString();
    const state = flight({ heading: 0, lastSeen });
    const result = interpolatePosition(state);
    expect(result.latitude).toBeGreaterThan(state.latitude);
    expect(result.longitude).toBeCloseTo(state.longitude, 3);
  });

  it("caps extrapolation at maxExtrapolationS instead of running away forever", () => {
    const lastSeen = new Date(Date.now() - 10_000_000).toISOString(); // ancient
    const state = flight({ lastSeen });
    const capped = interpolatePosition(state, Date.now(), 60);
    const uncapped = interpolatePosition(state, Date.now(), 10_000_000);
    // capped result should differ from what an unbounded extrapolation would produce
    expect(capped.longitude).not.toBeCloseTo(uncapped.longitude, 2);
  });
});

describe("dataAgeSeconds", () => {
  it("returns 0 for a timestamp in the future (never negative)", () => {
    expect(dataAgeSeconds(new Date(Date.now() + 10_000).toISOString())).toBe(0);
  });

  it("returns elapsed seconds for a past timestamp", () => {
    const age = dataAgeSeconds(new Date(Date.now() - 5_000).toISOString());
    expect(age).toBeGreaterThanOrEqual(4.9);
    expect(age).toBeLessThan(6);
  });
});

describe("positionConfidence", () => {
  it("is 1 at age 0", () => {
    expect(positionConfidence(0)).toBe(1);
  });

  it("decays monotonically as age increases toward STALE_AFTER_S", () => {
    const early = positionConfidence(10);
    const mid = positionConfidence(STALE_AFTER_S / 2);
    const late = positionConfidence(STALE_AFTER_S - 1);
    expect(early).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(late);
  });

  it("floors at 0.35 rather than going to zero", () => {
    expect(positionConfidence(STALE_AFTER_S)).toBeCloseTo(0.35);
    expect(positionConfidence(STALE_AFTER_S * 10)).toBeCloseTo(0.35);
  });
});

describe("markerFreshness", () => {
  it("is live at and before STALE_AFTER_S", () => {
    expect(markerFreshness(0)).toBe("live");
    expect(markerFreshness(STALE_AFTER_S)).toBe("live");
  });

  it("is stale just past STALE_AFTER_S", () => {
    expect(markerFreshness(STALE_AFTER_S + 1)).toBe("stale");
  });
});

describe("FlightStore", () => {
  it("upsert reports created on first insert, not on update", () => {
    const store = new FlightStore();
    expect(store.upsert(flight({ icao24: "aaa" })).created).toBe(true);
    expect(store.upsert(flight({ icao24: "aaa" })).created).toBe(false);
  });

  it("removeStale evicts aircraft older than the threshold and keeps fresh ones", () => {
    const store = new FlightStore();
    const now = Date.now();
    store.upsert(flight({ icao24: "old", lastSeen: new Date(now - REMOVE_AFTER_S * 1000 - 1000).toISOString() }));
    store.upsert(flight({ icao24: "fresh", lastSeen: new Date(now).toISOString() }));

    const removed = store.removeStale(REMOVE_AFTER_S * 1000, now);

    expect(removed).toBe(1);
    expect(store.get("old")).toBeUndefined();
    expect(store.get("fresh")).toBeDefined();
  });

  it("inBounds filters by bounding box", () => {
    const store = new FlightStore();
    store.upsert(flight({ icao24: "in", latitude: 48, longitude: 2 }));
    store.upsert(flight({ icao24: "out", latitude: 80, longitude: 2 }));

    const result = store.inBounds({ west: -10, south: 35, east: 30, north: 60 });

    expect(result.map((f) => f.icao24)).toEqual(["in"]);
  });
});
