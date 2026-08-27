import { describe, expect, it } from "vitest";
import { interpolateTrack, type TrackSample } from "./track-interpolate";

const T0 = Date.parse("2026-08-26T14:00:00.000Z");

function samples(): TrackSample[] {
  return [
    { time: T0, latitude: 48.0, longitude: 2.0, altitude: 10_000 },
    { time: T0 + 90_000, latitude: 48.1, longitude: 2.1, altitude: 10_200 },
    { time: T0 + 180_000, latitude: 48.2, longitude: 2.2, altitude: 10_400 },
  ];
}

describe("interpolateTrack", () => {
  it("returns null before the first observation", () => {
    expect(interpolateTrack(samples(), T0 - 1)).toBeNull();
  });

  it("returns the exact observation without interpolating", () => {
    const result = interpolateTrack(samples(), T0);
    expect(result?.interpolated).toBe(false);
    expect(result?.latitude).toBe(48.0);
    expect(result?.longitude).toBe(2.0);
  });

  it("lerps between observed points and labels the result as estimated", () => {
    const result = interpolateTrack(samples(), T0 + 45_000);
    expect(result?.interpolated).toBe(true);
    expect(result?.latitude).toBeCloseTo(48.05, 5);
    expect(result?.longitude).toBeCloseTo(2.05, 5);
    expect(result?.altitude).toBeCloseTo(10_100, 3);
    expect(result?.heading).toBeDefined();
    expect(result?.lastSeen).toBe(T0);
  });

  it("does not interpolate across a coverage gap", () => {
    const gapped: TrackSample[] = [
      { time: T0, latitude: 48, longitude: 2, altitude: 10_000 },
      { time: T0 + 600_000, latitude: 49, longitude: 3, altitude: 11_000 },
    ];
    const result = interpolateTrack(gapped, T0 + 60_000);
    expect(result?.interpolated).toBe(false);
    expect(result?.latitude).toBe(48);
    expect(result?.longitude).toBe(2);
  });

  it("holds the last observation briefly after the track ends, then drops", () => {
    const held = interpolateTrack(samples(), T0 + 180_000 + 30_000);
    expect(held?.latitude).toBe(48.2);
    expect(held?.interpolated).toBe(false);

    expect(interpolateTrack(samples(), T0 + 180_000 + 200_000)).toBeNull();
  });
});
