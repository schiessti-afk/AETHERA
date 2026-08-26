import { describe, expect, it } from "vitest";
import { flightStateSchema, inBoundingBox, isValidLatitude, isValidLongitude } from "./index";

describe("inBoundingBox", () => {
  const box = { west: -10, south: 35, east: 30, north: 60 };

  it("includes a point inside a normal (non-wrapping) box", () => {
    expect(inBoundingBox(48.8566, 2.3522, box)).toBe(true);
  });

  it("excludes a point outside the latitude span", () => {
    expect(inBoundingBox(70, 2.3522, box)).toBe(false);
  });

  it("excludes a point outside the longitude span", () => {
    expect(inBoundingBox(48.8566, 50, box)).toBe(false);
  });

  it("includes boundary points", () => {
    expect(inBoundingBox(box.south, box.west, box)).toBe(true);
    expect(inBoundingBox(box.north, box.east, box)).toBe(true);
  });

  it("handles a box crossing the antimeridian (west > east)", () => {
    const wrapping = { west: 170, south: 0, east: -170, north: 10 };
    expect(inBoundingBox(5, 175, wrapping)).toBe(true); // just past 170
    expect(inBoundingBox(5, -175, wrapping)).toBe(true); // just before -170
    expect(inBoundingBox(5, 0, wrapping)).toBe(false); // the excluded middle
  });
});

describe("isValidLatitude / isValidLongitude", () => {
  it("accepts values within range", () => {
    expect(isValidLatitude(90)).toBe(true);
    expect(isValidLatitude(-90)).toBe(true);
    expect(isValidLongitude(180)).toBe(true);
    expect(isValidLongitude(-180)).toBe(true);
  });

  it("rejects out-of-range and non-finite values", () => {
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(NaN)).toBe(false);
    expect(isValidLongitude(181)).toBe(false);
    expect(isValidLongitude(Infinity)).toBe(false);
  });

  it("rejects non-numbers", () => {
    expect(isValidLatitude("48")).toBe(false);
    expect(isValidLongitude(null)).toBe(false);
  });
});

describe("flightStateSchema", () => {
  const valid = {
    icao24: "3c4a12",
    latitude: 48.8566,
    longitude: 2.3522,
    onGround: false,
    lastSeen: "2026-08-26T12:00:00.000Z",
    receivedAt: "2026-08-26T12:00:00.000Z",
    processedAt: "2026-08-26T12:00:00.000Z",
  };

  it("accepts a minimal valid flight state", () => {
    expect(flightStateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing icao24", () => {
    const { icao24, ...rest } = valid;
    expect(flightStateSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects an out-of-range latitude", () => {
    expect(flightStateSchema.safeParse({ ...valid, latitude: 91 }).success).toBe(false);
  });

  it("rejects a negative velocity", () => {
    expect(flightStateSchema.safeParse({ ...valid, velocity: -5 }).success).toBe(false);
  });
});
