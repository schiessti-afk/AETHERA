import { describe, expect, it } from "vitest";
import type { FlightState } from "@aethera/types";
import { ALTITUDE_BANDS_FT, SPEED_BANDS_KT, summariseAirspace } from "./aggregate";

const NOW = "2026-08-26T20:00:00.000Z";
const FT_TO_M = 0.3048;
const KT_TO_MPS = 0.514444;
const FPM_TO_MPS = 1 / 196.85;

function flight(overrides: Partial<FlightState> = {}): FlightState {
  return {
    icao24: "abc123",
    latitude: 48,
    longitude: 2,
    onGround: false,
    lastSeen: NOW,
    receivedAt: NOW,
    processedAt: NOW,
    ...overrides,
  };
}

describe("summariseAirspace", () => {
  it("counts airborne and grounded aircraft separately", () => {
    const result = summariseAirspace([
      flight({ icao24: "a" }),
      flight({ icao24: "b" }),
      flight({ icao24: "c", onGround: true }),
    ]);

    expect(result.observed).toBe(3);
    expect(result.airborne).toBe(2);
    expect(result.onGround).toBe(1);
  });

  it("splits climbing, descending and level by vertical rate", () => {
    const result = summariseAirspace([
      flight({ icao24: "a", verticalRate: 1000 * FPM_TO_MPS }),
      flight({ icao24: "b", verticalRate: -1000 * FPM_TO_MPS }),
      flight({ icao24: "c", verticalRate: 0 }),
    ]);

    expect(result.climbing).toBe(1);
    expect(result.descending).toBe(1);
    expect(result.level).toBe(1);
  });

  it("treats a small vertical rate as level rather than climbing", () => {
    const result = summariseAirspace([
      flight({ verticalRate: 100 * FPM_TO_MPS }),
    ]);
    expect(result.level).toBe(1);
    expect(result.climbing).toBe(0);
  });

  it("excludes aircraft with no vertical rate from the climb balance entirely", () => {
    // An unknown value is not level — counting it as such would invent structure
    // that was never observed.
    const result = summariseAirspace([flight({ verticalRate: undefined })]);

    expect(result.airborne).toBe(1);
    expect(result.climbing + result.descending + result.level).toBe(0);
  });

  it("does not count grounded aircraft in the climb balance", () => {
    const result = summariseAirspace([
      flight({ onGround: true, verticalRate: 2000 * FPM_TO_MPS }),
    ]);
    expect(result.climbing).toBe(0);
  });

  it("places altitudes in the correct band", () => {
    const result = summariseAirspace([
      flight({ icao24: "a", altitude: 500 * FT_TO_M }),
      flight({ icao24: "b", altitude: 3_000 * FT_TO_M }),
      flight({ icao24: "c", altitude: 35_000 * FT_TO_M }),
      flight({ icao24: "d", altitude: 45_000 * FT_TO_M }),
    ]);

    expect(result.altitudeBands["0"]).toBe(1);
    expect(result.altitudeBands["1000"]).toBe(1);
    expect(result.altitudeBands["30000"]).toBe(1);
    expect(result.altitudeBands["40000"]).toBe(1);
  });

  it("places a value exactly on a band boundary in the upper band", () => {
    const result = summariseAirspace([flight({ altitude: 30_000 * FT_TO_M })]);
    expect(result.altitudeBands["30000"]).toBe(1);
    expect(result.altitudeBands["20000"]).toBe(0);
  });

  it("omits aircraft with unknown altitude from every band", () => {
    const result = summariseAirspace([flight({ altitude: undefined })]);
    const total = Object.values(result.altitudeBands).reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
  });

  it("does not put grounded aircraft into altitude bands", () => {
    const result = summariseAirspace([
      flight({ onGround: true, altitude: 35_000 * FT_TO_M }),
    ]);
    const total = Object.values(result.altitudeBands).reduce((a, b) => a + b, 0);
    expect(total).toBe(0);
  });

  it("bands ground speed, including grounded aircraft", () => {
    const result = summariseAirspace([
      flight({ icao24: "a", velocity: 50 * KT_TO_MPS, onGround: true }),
      flight({ icao24: "b", velocity: 450 * KT_TO_MPS }),
    ]);

    expect(result.speedBands["0"]).toBe(1);
    expect(result.speedBands["400"]).toBe(1);
  });

  it("returns a fully populated histogram even with no aircraft", () => {
    const result = summariseAirspace([]);

    expect(Object.keys(result.altitudeBands)).toEqual(
      ALTITUDE_BANDS_FT.map(String),
    );
    expect(Object.keys(result.speedBands)).toEqual(SPEED_BANDS_KT.map(String));
    expect(result.observed).toBe(0);
  });

  it("carries the supplied anomaly count and timestamp", () => {
    const result = summariseAirspace([], { observedAt: NOW, activeAnomalies: 3 });
    expect(result.observedAt).toBe(NOW);
    expect(result.activeAnomalies).toBe(3);
  });
});
