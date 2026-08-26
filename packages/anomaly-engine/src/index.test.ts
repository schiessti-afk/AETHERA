import { describe, expect, it } from "vitest";
import type { Anomaly, FlightState } from "@aethera/types";
import {
  DEFAULT_THRESHOLDS,
  anomalyKey,
  anomalyLabel,
  evaluateSnapshot,
} from "./index";

const NOW = "2026-08-26T20:00:00.000Z";
const MPS_PER_FPM = 1 / 196.85;

function flight(overrides: Partial<FlightState> = {}): FlightState {
  return {
    icao24: "abc123",
    latitude: 48.8566,
    longitude: 2.3522,
    onGround: false,
    lastSeen: NOW,
    receivedAt: NOW,
    processedAt: NOW,
    ...overrides,
  };
}

/** Vertical rate in m/s for a given feet-per-minute figure. */
const fpm = (value: number) => value * MPS_PER_FPM;

function at(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

describe("emergency squawk (state condition)", () => {
  it("raises a critical detection for 7700", () => {
    const result = evaluateSnapshot({ flights: [flight({ squawk: "7700" })], now: NOW });

    expect(result.detected).toHaveLength(1);
    expect(result.detected[0].type).toBe("EMERGENCY_SQUAWK");
    expect(result.detected[0].severity).toBe("critical");
    expect(result.detected[0].kind).toBe("state");
    expect(result.detected[0].value).toBe("7700");
  });

  it.each(["7500", "7600", "7700"])("detects %s", (squawk) => {
    const result = evaluateSnapshot({ flights: [flight({ squawk })], now: NOW });
    expect(result.detected).toHaveLength(1);
    expect(result.detected[0].value).toBe(squawk);
  });

  it("ignores an ordinary squawk", () => {
    const result = evaluateSnapshot({ flights: [flight({ squawk: "2143" })], now: NOW });
    expect(result.detected).toHaveLength(0);
  });

  it("does not re-announce a squawk that is still being transmitted", () => {
    const first = evaluateSnapshot({ flights: [flight({ squawk: "7700" })], now: NOW });
    const second = evaluateSnapshot({
      flights: [flight({ squawk: "7700" })],
      active: first.active,
      lastDetected: first.lastDetected,
      now: at(NOW, 2),
    });

    expect(second.detected).toHaveLength(0);
    expect(second.resolved).toHaveLength(0);
    expect(Object.keys(second.active)).toHaveLength(1);
  });

  it("resolves the condition once the aircraft stops squawking it", () => {
    const first = evaluateSnapshot({ flights: [flight({ squawk: "7700" })], now: NOW });
    const second = evaluateSnapshot({
      flights: [flight({ squawk: "2000" })],
      active: first.active,
      now: at(NOW, 2),
    });

    expect(second.resolved).toHaveLength(1);
    expect(second.resolved[0].type).toBe("EMERGENCY_SQUAWK");
    expect(second.resolved[0].resolvedAt).toBe(at(NOW, 2));
    expect(second.active).toEqual({});
  });

  it("treats a changed emergency code as resolve-then-detect, not a silent update", () => {
    const first = evaluateSnapshot({ flights: [flight({ squawk: "7700" })], now: NOW });
    const second = evaluateSnapshot({
      flights: [flight({ squawk: "7600" })],
      active: first.active,
      now: at(NOW, 2),
    });

    expect(second.resolved.map((a) => a.value)).toEqual(["7700"]);
    expect(second.detected.map((a) => a.value)).toEqual(["7600"]);
  });
});

describe("extreme vertical rate (point-in-time events)", () => {
  it("detects a descent past the threshold", () => {
    const result = evaluateSnapshot({
      flights: [flight({ verticalRate: fpm(-4000) })],
      now: NOW,
    });

    expect(result.detected).toHaveLength(1);
    expect(result.detected[0].type).toBe("RAPID_DESCENT");
    expect(result.detected[0].severity).toBe("high");
    expect(result.detected[0].kind).toBe("event");
  });

  it("detects a climb past the threshold", () => {
    const result = evaluateSnapshot({
      flights: [flight({ verticalRate: fpm(4000) })],
      now: NOW,
    });
    expect(result.detected[0].type).toBe("RAPID_CLIMB");
  });

  it("ignores an ordinary airliner descent", () => {
    // -2000 fpm is a routine descent; the old -1000 fpm threshold fired on 10.5%
    // of all observed traffic, which is what this guards against.
    const result = evaluateSnapshot({
      flights: [flight({ verticalRate: fpm(-2000) })],
      now: NOW,
    });
    expect(result.detected).toHaveLength(0);
  });

  it("ignores vertical rate on the ground", () => {
    const result = evaluateSnapshot({
      flights: [flight({ verticalRate: fpm(-5000), onGround: true })],
      now: NOW,
    });
    expect(result.detected).toHaveLength(0);
  });

  it("ignores an aircraft with no vertical rate reported", () => {
    const result = evaluateSnapshot({ flights: [flight()], now: NOW });
    expect(result.detected).toHaveLength(0);
  });

  it("never holds an event open as active state", () => {
    const result = evaluateSnapshot({
      flights: [flight({ verticalRate: fpm(-4000) })],
      now: NOW,
    });
    expect(result.active).toEqual({});
  });

  it("does not re-announce the same condition within the cooldown", () => {
    const first = evaluateSnapshot({
      flights: [flight({ verticalRate: fpm(-4000) })],
      now: NOW,
    });
    const second = evaluateSnapshot({
      flights: [flight({ verticalRate: fpm(-4000) })],
      lastDetected: first.lastDetected,
      now: at(NOW, 2),
    });

    expect(second.detected).toHaveLength(0);
  });

  it("announces again once the cooldown has elapsed", () => {
    const first = evaluateSnapshot({
      flights: [flight({ verticalRate: fpm(-4000) })],
      now: NOW,
    });
    const later = at(NOW, DEFAULT_THRESHOLDS.cooldownMs / 60_000 + 1);
    const second = evaluateSnapshot({
      flights: [flight({ verticalRate: fpm(-4000) })],
      lastDetected: first.lastDetected,
      now: later,
    });

    expect(second.detected).toHaveLength(1);
  });

  it("forgets cooldown entries once they age out", () => {
    const first = evaluateSnapshot({
      flights: [flight({ verticalRate: fpm(-4000) })],
      now: NOW,
    });
    const second = evaluateSnapshot({
      flights: [],
      lastDetected: first.lastDetected,
      now: at(NOW, 60),
    });

    expect(second.lastDetected).toEqual({});
  });

  it("honours overridden thresholds", () => {
    const result = evaluateSnapshot({
      flights: [flight({ verticalRate: fpm(-1500) })],
      thresholds: { rapidDescentFpm: -1000 },
      now: NOW,
    });
    expect(result.detected).toHaveLength(1);
  });
});

describe("lost signal (watched aircraft only)", () => {
  const previous = [flight({ icao24: "aaa111", callsign: "TEST123" })];

  it("raises when a watched aircraft disappears", () => {
    const result = evaluateSnapshot({
      flights: [],
      previous,
      watched: ["aaa111"],
      now: NOW,
    });

    expect(result.detected).toHaveLength(1);
    expect(result.detected[0].type).toBe("LOST_SIGNAL");
    expect(result.detected[0].severity).toBe("medium");
  });

  it("carries the last known telemetry so the alert can be acted on", () => {
    const result = evaluateSnapshot({
      flights: [],
      previous,
      watched: ["aaa111"],
      now: NOW,
    });

    expect(result.detected[0].callsign).toBe("TEST123");
    expect(result.detected[0].latitude).toBe(48.8566);
    expect(result.detected[0].longitude).toBe(2.3522);
  });

  it("stays silent for an unwatched aircraft that drops out", () => {
    // ~246 airborne aircraft leave receiver coverage every poll globally; only
    // aircraft a user is actually watching are worth an alert.
    const result = evaluateSnapshot({ flights: [], previous, now: NOW });
    expect(result.detected).toHaveLength(0);
  });

  it("stays silent for a watched aircraft that was never observed", () => {
    const result = evaluateSnapshot({
      flights: [],
      previous: [],
      watched: ["aaa111"],
      now: NOW,
    });
    expect(result.detected).toHaveLength(0);
  });

  it("does not re-announce while the aircraft stays missing", () => {
    const first = evaluateSnapshot({
      flights: [],
      previous,
      watched: ["aaa111"],
      now: NOW,
    });
    const second = evaluateSnapshot({
      flights: [],
      previous,
      watched: ["aaa111"],
      active: first.active,
      lastDetected: first.lastDetected,
      now: at(NOW, 2),
    });

    expect(second.detected).toHaveLength(0);
    expect(Object.keys(second.active)).toHaveLength(1);
  });

  it("resolves when the aircraft is observed again", () => {
    const first = evaluateSnapshot({
      flights: [],
      previous,
      watched: ["aaa111"],
      now: NOW,
    });
    const second = evaluateSnapshot({
      flights: [flight({ icao24: "aaa111" })],
      previous,
      watched: ["aaa111"],
      active: first.active,
      now: at(NOW, 2),
    });

    expect(second.resolved).toHaveLength(1);
    expect(second.resolved[0].type).toBe("LOST_SIGNAL");
    expect(second.active).toEqual({});
  });
});

describe("deferred detections", () => {
  it("does not detect sudden heading change", () => {
    // Catalogued but not detected: 6.6% of airborne traffic turns >90° between two
    // consecutive 90s polls, so this would measure the poll interval, not the aircraft.
    const result = evaluateSnapshot({
      flights: [flight({ heading: 350 })],
      previous: [flight({ heading: 10 })],
      now: NOW,
    });
    expect(result.detected).toHaveLength(0);
  });
});

describe("resolution reporting", () => {
  it("returns resolved anomalies rather than discarding them", () => {
    const active: Record<string, Anomaly> = {
      [anomalyKey("zzz999", "EMERGENCY_SQUAWK")]: {
        id: anomalyKey("zzz999", "EMERGENCY_SQUAWK"),
        type: "EMERGENCY_SQUAWK",
        kind: "state",
        severity: "critical",
        icao24: "zzz999",
        value: "7700",
        detectedAt: NOW,
      },
    };

    const result = evaluateSnapshot({ flights: [], active, now: at(NOW, 5) });

    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].resolvedAt).toBe(at(NOW, 5));
    expect(result.active).toEqual({});
  });
});

describe("anomalyLabel", () => {
  it("names the observed squawk code rather than asserting an emergency", () => {
    expect(anomalyLabel({ type: "EMERGENCY_SQUAWK", value: "7700" })).toBe("7700 OBSERVED");
    expect(anomalyLabel({ type: "EMERGENCY_SQUAWK", value: "7500" })).toBe("7500 OBSERVED");
    expect(anomalyLabel({ type: "EMERGENCY_SQUAWK", value: "7600" })).toBe("7600 OBSERVED");
  });

  it("uses detection language for derived conditions", () => {
    expect(anomalyLabel({ type: "RAPID_DESCENT", value: -20 })).toBe("RAPID DESCENT DETECTED");
    expect(anomalyLabel({ type: "LOST_SIGNAL", value: "no contact" })).toBe("SIGNAL LOST");
  });
});
