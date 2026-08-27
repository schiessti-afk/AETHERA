import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, expandRow, parseWindow, type TrackHourRow } from "./history";

const HOUR = new Date("2026-08-26T14:00:00.000Z");

function row(overrides: Partial<TrackHourRow> = {}): TrackHourRow {
  return {
    icao24: "abc123",
    hour_start: HOUR,
    point_count: 2,
    t_off: [10, 100],
    lats: [48.85, 48.86],
    lons: [2.35, 2.36],
    alts: [10000, 10100],
    ...overrides,
  };
}

describe("history expandRow", () => {
  it("expands packed arrays in the API layer, not in SQL", () => {
    const expanded = expandRow(row(), {
      fromMs: HOUR.getTime(),
      toMs: HOUR.getTime() + 3_600_000,
    });
    expect(expanded?.points).toHaveLength(2);
    expect(expanded?.points[0].time).toBe("2026-08-26T14:00:10.000Z");
    expect(expanded?.points[1].latitude).toBe(48.86);
    expect(expanded?.points[1].altitude).toBe(10100);
  });

  it("filters expanded points to the requested region", () => {
    const expanded = expandRow(
      row(),
      { fromMs: HOUR.getTime(), toMs: HOUR.getTime() + 3_600_000 },
      { west: 2.355, south: 48, east: 3, north: 49 },
    );
    expect(expanded?.points).toHaveLength(1);
    expect(expanded?.points[0].longitude).toBe(2.36);
  });

  it("returns null when no points survive the window", () => {
    expect(
      expandRow(row(), {
        fromMs: HOUR.getTime() + 200_000,
        toMs: HOUR.getTime() + 300_000,
      }),
    ).toBeNull();
  });
});

describe("history cursor", () => {
  it("round-trips", () => {
    const encoded = encodeCursor({ hourStart: HOUR.toISOString(), icao24: "abc123" });
    expect(decodeCursor(encoded)).toEqual({ hourStart: HOUR.toISOString(), icao24: "abc123" });
  });
});

describe("parseWindow", () => {
  it("rejects inverted and oversized windows", () => {
    expect(() => parseWindow("2026-08-26T15:00:00Z", "2026-08-26T14:00:00Z", 3_600_000)).toThrow();
    expect(() => parseWindow("2026-08-26T14:00:00Z", "2026-08-26T22:00:00Z", 6 * 3_600_000)).toThrow(
      /exceeds/,
    );
  });
});
