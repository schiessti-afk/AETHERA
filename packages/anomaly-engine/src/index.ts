import type {
  Anomaly,
  AnomalyKind,
  AnomalySeverity,
  AnomalyType,
  FlightState,
} from "@aethera/types";

const MPS_TO_FPM = 196.85;

const EMERGENCY_SQUAWKS = new Set(["7500", "7600", "7700"]);

/**
 * Detection thresholds are product decisions, not physics — PRODUCT_SPEC §26.4 requires
 * them to be documented, tunable, and conservative ("false calm is better than false
 * alarm").
 *
 * These defaults were chosen against a real global snapshot of ~11,800 aircraft:
 *
 *   descent < -1000 fpm  ->  1,239 aircraft (10.5% of all traffic)
 *   descent < -2000 fpm  ->    284
 *   descent < -3000 fpm  ->     45
 *   descent < -3500 fpm  ->     25
 *   climb   > +2000 fpm  ->    389
 *   climb   > +3500 fpm  ->     29
 *
 * ±3500 fpm yields ~54 active detections globally — a feed a person can read. The
 * original ±1000/+2000 would have produced 1,628 simultaneous alerts with no actual
 * emergency anywhere in the sample.
 */
export interface AnomalyThresholds {
  /** Negative, in feet per minute. */
  rapidDescentFpm: number;
  /** Positive, in feet per minute. */
  rapidClimbFpm: number;
  /** Suppress re-detection of the same condition on the same aircraft for this long. */
  cooldownMs: number;
}

export const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  rapidDescentFpm: -3500,
  rapidClimbFpm: 3500,
  cooldownMs: 10 * 60_000,
};

const KIND: Record<AnomalyType, AnomalyKind> = {
  EMERGENCY_SQUAWK: "state",
  LOST_SIGNAL: "state",
  RAPID_DESCENT: "event",
  RAPID_CLIMB: "event",
  SUDDEN_HEADING_CHANGE: "event",
  SUDDEN_ALTITUDE_CHANGE: "event",
};

const SEVERITY: Record<AnomalyType, AnomalySeverity> = {
  EMERGENCY_SQUAWK: "critical",
  RAPID_DESCENT: "high",
  RAPID_CLIMB: "high",
  LOST_SIGNAL: "medium",
  SUDDEN_HEADING_CHANGE: "medium",
  SUDDEN_ALTITUDE_CHANGE: "medium",
};

/** Stable key for one condition on one aircraft — used for dedupe and cooldown. */
export function anomalyKey(icao24: string, type: AnomalyType): string {
  return `${icao24}:${type}`;
}

/**
 * Observational copy — PRODUCT_SPEC §18.1. These are detections on a transponder
 * signal, never assertions about what is happening on board, so the language stays
 * at what was observed ("7700 OBSERVED", not "EMERGENCY").
 */
export function anomalyLabel(anomaly: Pick<Anomaly, "type" | "value">): string {
  switch (anomaly.type) {
    case "EMERGENCY_SQUAWK":
      return `${anomaly.value} OBSERVED`;
    case "RAPID_DESCENT":
      return "RAPID DESCENT DETECTED";
    case "RAPID_CLIMB":
      return "RAPID CLIMB DETECTED";
    case "LOST_SIGNAL":
      return "SIGNAL LOST";
    case "SUDDEN_HEADING_CHANGE":
      return "SUDDEN HEADING CHANGE DETECTED";
    case "SUDDEN_ALTITUDE_CHANGE":
      return "SUDDEN ALTITUDE CHANGE DETECTED";
  }
}

/** Telemetry carried onto an anomaly; position may be absent for a lost aircraft. */
type DetectionSubject = {
  icao24: string;
  callsign?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
};

function build(
  type: AnomalyType,
  flight: DetectionSubject,
  value: string | number,
  now: string,
): Anomaly {
  return {
    id: anomalyKey(flight.icao24, type),
    type,
    kind: KIND[type],
    severity: SEVERITY[type],
    icao24: flight.icao24,
    callsign: flight.callsign,
    latitude: flight.latitude,
    longitude: flight.longitude,
    altitude: flight.altitude,
    value,
    detectedAt: now,
  };
}

export interface EvaluateInput {
  flights: FlightState[];
  /** State anomalies currently open, keyed by `anomalyKey`. */
  active?: Record<string, Anomaly>;
  /** `anomalyKey` -> ISO time of the last detection, used to honour the cooldown. */
  lastDetected?: Record<string, string>;
  /**
   * The previous snapshot. Disappearance is only meaningful relative to a known
   * previous state, and the last-known telemetry is what a LOST_SIGNAL alert needs to
   * be actionable (it is the position to fly the camera to).
   */
  previous?: readonly FlightState[];
  /**
   * icao24s a client currently has selected or followed. LOST_SIGNAL is raised only
   * for these: on global coverage, ~246 airborne aircraft drop out of every poll simply
   * by leaving receiver range, so an unscoped signal-loss alert is pure noise. Aircraft
   * that go quiet without being watched are still shown as stale on the map.
   */
  watched?: readonly string[];
  now?: string;
  thresholds?: Partial<AnomalyThresholds>;
}

export interface EvaluateResult {
  /** Newly raised this cycle. */
  detected: Anomaly[];
  /**
   * Closed this cycle, carrying `resolvedAt`. Returned rather than discarded so
   * callers can persist and broadcast the resolution.
   */
  resolved: Anomaly[];
  /** The next active set, to be stored and passed back on the following cycle. */
  active: Record<string, Anomaly>;
  /** The next cooldown map, to be stored and passed back on the following cycle. */
  lastDetected: Record<string, string>;
}

/**
 * Pure evaluation of one snapshot against the previous cycle's state.
 *
 * Deliberately holds no internal state: ingestion restores `active`/`lastDetected` from
 * Redis and writes back what comes out (ARCHITECTURE §19). Keeping it out of process
 * memory means an ingestion restart doesn't re-announce every open condition.
 */
export function evaluateSnapshot(input: EvaluateInput): EvaluateResult {
  const now = input.now ?? new Date().toISOString();
  const nowMs = Date.parse(now);
  const thresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };

  const previousActive = input.active ?? {};
  const lastDetected: Record<string, string> = { ...(input.lastDetected ?? {}) };
  const watched = new Set(input.watched ?? []);
  const previous = new Map((input.previous ?? []).map((f) => [f.icao24, f]));

  const detected: Anomaly[] = [];
  const resolved: Anomaly[] = [];
  const nextActive: Record<string, Anomaly> = {};

  const withinCooldown = (key: string): boolean => {
    const previousDetection = lastDetected[key];
    if (!previousDetection) return false;
    return nowMs - Date.parse(previousDetection) < thresholds.cooldownMs;
  };

  const raise = (anomaly: Anomaly): void => {
    detected.push(anomaly);
    lastDetected[anomaly.id] = now;
  };

  const present = new Set<string>();

  for (const flight of input.flights) {
    present.add(flight.icao24);

    // --- State condition: emergency squawk -------------------------------------
    const squawkKey = anomalyKey(flight.icao24, "EMERGENCY_SQUAWK");
    if (flight.squawk && EMERGENCY_SQUAWKS.has(flight.squawk)) {
      const open = previousActive[squawkKey];
      if (open && open.value === flight.squawk) {
        // Same code still being transmitted — stays open, not re-announced (§18.4).
        nextActive[squawkKey] = open;
      } else {
        // Either newly observed, or the code changed (e.g. 7700 -> 7600), which is a
        // different condition: close the old one and raise the new.
        if (open) resolved.push({ ...open, resolvedAt: now });
        const anomaly = build("EMERGENCY_SQUAWK", flight, flight.squawk, now);
        nextActive[squawkKey] = anomaly;
        raise(anomaly);
      }
    }

    // --- State condition: signal restored --------------------------------------
    // An aircraft that was flagged lost and is being observed again closes that alert.
    const lostKey = anomalyKey(flight.icao24, "LOST_SIGNAL");
    const openLost = previousActive[lostKey];
    if (openLost) {
      resolved.push({ ...openLost, resolvedAt: now });
    }

    // --- Point-in-time events: extreme vertical rate ----------------------------
    if (flight.verticalRate != null && !flight.onGround) {
      const fpm = flight.verticalRate * MPS_TO_FPM;

      if (fpm < thresholds.rapidDescentFpm) {
        const key = anomalyKey(flight.icao24, "RAPID_DESCENT");
        if (!withinCooldown(key)) {
          raise(build("RAPID_DESCENT", flight, flight.verticalRate, now));
        }
      } else if (fpm > thresholds.rapidClimbFpm) {
        const key = anomalyKey(flight.icao24, "RAPID_CLIMB");
        if (!withinCooldown(key)) {
          raise(build("RAPID_CLIMB", flight, flight.verticalRate, now));
        }
      }
    }
  }

  // --- State condition: lost signal, watched aircraft only ---------------------
  for (const icao24 of watched) {
    if (present.has(icao24)) continue;
    const lastKnown = previous.get(icao24);
    if (!lastKnown) continue; // never seen, so nothing was lost

    const key = anomalyKey(icao24, "LOST_SIGNAL");
    if (previousActive[key]) {
      nextActive[key] = previousActive[key]; // still lost, already announced
      continue;
    }
    if (withinCooldown(key)) continue;

    const anomaly = build("LOST_SIGNAL", lastKnown, "no contact", now);
    nextActive[key] = anomaly;
    raise(anomaly);
  }

  // --- Close any state condition that is no longer holding ---------------------
  for (const [key, anomaly] of Object.entries(previousActive)) {
    if (nextActive[key]) continue;
    if (resolved.some((r) => r.id === key)) continue; // already closed above
    resolved.push({ ...anomaly, resolvedAt: now });
  }

  // Forget cooldown entries once they have aged out, so the map can't grow without bound.
  for (const [key, at] of Object.entries(lastDetected)) {
    if (nowMs - Date.parse(at) > thresholds.cooldownMs) delete lastDetected[key];
  }

  return { detected, resolved, active: nextActive, lastDetected };
}
