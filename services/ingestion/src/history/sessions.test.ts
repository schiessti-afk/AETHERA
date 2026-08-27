import { describe, expect, it } from "vitest";
import { applyObservation, DEFAULT_SESSION_GAP_MS, type OpenSession } from "./sessions";

const T0 = Date.parse("2026-08-26T12:00:00.000Z");

function obs(overrides: { callsign?: string | null; timeMs?: number; icao24?: string } = {}) {
  return {
    icao24: overrides.icao24 ?? "abc123",
    callsign: overrides.callsign === undefined ? "BAW123" : overrides.callsign,
    timeMs: overrides.timeMs ?? T0,
    latitude: 51.47,
    longitude: -0.45,
  };
}

function session(overrides: Partial<OpenSession> = {}): OpenSession {
  return {
    id: 1,
    icao24: "abc123",
    callsign: "BAW123",
    startedAt: T0,
    endedAt: T0,
    pointCount: 1,
    minLat: 51.47,
    maxLat: 51.47,
    minLon: -0.45,
    maxLon: -0.45,
    dirty: false,
    isNew: false,
    ...overrides,
  };
}

describe("applyObservation", () => {
  it("opens a session when none exists", () => {
    const { session: next, closed } = applyObservation(undefined, obs());
    expect(closed).toBeNull();
    expect(next.isNew).toBe(true);
    expect(next.callsign).toBe("BAW123");
    expect(next.pointCount).toBe(1);
  });

  it("extends a session for the same callsign within the gap", () => {
    const open = session();
    const { session: next, closed } = applyObservation(
      open,
      obs({ timeMs: T0 + 10 * 60_000 }),
    );
    expect(closed).toBeNull();
    expect(next).toBe(open);
    expect(next.pointCount).toBe(2);
    expect(next.endedAt).toBe(T0 + 10 * 60_000);
    expect(next.dirty).toBe(true);
  });

  it("closes and reopens on a callsign change even with no gap", () => {
    const open = session();
    const { session: next, closed } = applyObservation(
      open,
      obs({ callsign: "BAW124", timeMs: T0 + 90_000 }),
    );
    expect(closed).toBe(open);
    expect(next.isNew).toBe(true);
    expect(next.callsign).toBe("BAW124");
    expect(next.startedAt).toBe(T0 + 90_000);
  });

  it("closes and reopens when the gap exceeds the tolerance", () => {
    const open = session();
    const { session: next, closed } = applyObservation(
      open,
      obs({ timeMs: T0 + DEFAULT_SESSION_GAP_MS + 1 }),
    );
    expect(closed).toBe(open);
    expect(next.isNew).toBe(true);
    expect(next.startedAt).toBe(T0 + DEFAULT_SESSION_GAP_MS + 1);
  });

  it("treats a missing callsign as a distinct key from a present one", () => {
    const open = session({ callsign: null });
    const { closed } = applyObservation(open, obs({ callsign: "BAW123", timeMs: T0 + 90_000 }));
    expect(closed).toBe(open);
  });

  it("normalizes callsign case so 'baw123' continues 'BAW123'", () => {
    const open = session();
    const { session: next, closed } = applyObservation(
      open,
      obs({ callsign: "baw123", timeMs: T0 + 90_000 }),
    );
    expect(closed).toBeNull();
    expect(next.pointCount).toBe(2);
  });
});
