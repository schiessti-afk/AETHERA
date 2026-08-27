import { describe, expect, it } from "vitest";
import {
  expandHour,
  packByHour,
  packHour,
  secondsOffset,
  utcHourStartMs,
  type ObservedTrackPoint,
} from "./track-pack";

const HOUR = Date.parse("2026-08-26T14:00:00.000Z");

function point(overrides: Partial<ObservedTrackPoint> = {}): ObservedTrackPoint {
  return {
    icao24: "abc123",
    timeMs: HOUR + 74_000,
    latitude: 48.8566,
    longitude: 2.3522,
    altitude: 10_668,
    ...overrides,
  };
}

describe("utcHourStartMs", () => {
  it("truncates to the UTC hour", () => {
    expect(utcHourStartMs(HOUR + 3_599_000)).toBe(HOUR);
    expect(utcHourStartMs(HOUR)).toBe(HOUR);
    expect(utcHourStartMs(HOUR + 3_600_000)).toBe(HOUR + 3_600_000);
  });
});

describe("secondsOffset", () => {
  it("is exact for epoch seconds that REAL cannot represent as absolute time", () => {
    // 1787786914 stored as REAL becomes ~1787790000 (PHASE4 §2.4). As an offset
    // from the hour it is 2914, which REAL represents exactly.
    const epochS = 1_787_786_914;
    const hourStartMs = utcHourStartMs(epochS * 1000);
    const offset = secondsOffset(epochS * 1000, hourStartMs);
    expect(offset).toBe(epochS - hourStartMs / 1000);
    expect(hourStartMs + offset * 1000).toBe(epochS * 1000);
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThan(3600);
  });
});

describe("packHour / expandHour", () => {
  it("round-trips observed points without shifting timestamps", () => {
    const points = [
      point({ timeMs: HOUR + 1_000 }),
      point({ timeMs: HOUR + 91_000, latitude: 48.86, longitude: 2.36 }),
      point({ timeMs: HOUR + 3_599_000, altitude: null }),
    ];
    const packed = packHour(points);
    expect(packed).not.toBeNull();
    expect(packed!.pointCount).toBe(3);
    expect(packed!.hourStartMs).toBe(HOUR);
    expect(packed!.tOff[0]).toBe(1);
    expect(packed!.tOff[2]).toBe(3599);
    expect(packed!.alts[2]).toBeNull();
    expect(packed!.minLat).toBe(48.8566);
    expect(packed!.maxLat).toBe(48.86);

    const expanded = expandHour(packed!);
    expect(expanded).toHaveLength(3);
    expect(expanded[0].timeMs).toBe(HOUR + 1_000);
    expect(expanded[2].timeMs).toBe(HOUR + 3_599_000);
    expect(expanded[2].altitude).toBeNull();
  });

  it("drops points that belong to a different hour", () => {
    const packed = packHour([
      point({ timeMs: HOUR + 10_000 }),
      point({ timeMs: HOUR + 3_600_000 }),
    ]);
    expect(packed!.pointCount).toBe(1);
  });

  it("filters expanded points to a window without expanding in SQL", () => {
    const packed = packHour([
      point({ timeMs: HOUR + 10_000 }),
      point({ timeMs: HOUR + 1_800_000 }),
      point({ timeMs: HOUR + 3_000_000 }),
    ]);
    const slice = expandHour(packed!, { fromMs: HOUR + 1_000_000, toMs: HOUR + 2_000_000 });
    expect(slice).toHaveLength(1);
    expect(slice[0].timeMs).toBe(HOUR + 1_800_000);
  });
});

describe("packByHour", () => {
  it("splits mixed hours and aircraft into separate rows", () => {
    const packed = packByHour([
      point({ icao24: "aaa", timeMs: HOUR + 1_000 }),
      point({ icao24: "aaa", timeMs: HOUR + 3_700_000 }),
      point({ icao24: "bbb", timeMs: HOUR + 2_000 }),
    ]);
    expect(packed).toHaveLength(3);
  });
});
