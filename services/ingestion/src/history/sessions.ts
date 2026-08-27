import type { FlightState } from "@aethera/types";

export const DEFAULT_SESSION_GAP_MS = 120 * 60_000;

export interface OpenSession {
  id: number | null;
  icao24: string;
  callsign: string | null;
  startedAt: number;
  endedAt: number;
  pointCount: number;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  dirty: boolean;
  isNew: boolean;
}

export interface Observation {
  icao24: string;
  callsign: string | null;
  timeMs: number;
  latitude: number;
  longitude: number;
}

function normalizeCallsign(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : null;
}

function expandBox(session: OpenSession, lat: number, lon: number): void {
  if (lat < session.minLat) session.minLat = lat;
  if (lat > session.maxLat) session.maxLat = lat;
  if (lon < session.minLon) session.minLon = lon;
  if (lon > session.maxLon) session.maxLon = lon;
}

/**
 * Apply one observation to the current open session for that aircraft.
 *
 * A session is keyed on (icao24, callsign). It closes when the callsign changes
 * or when the gap since the last point exceeds `gapMs`. Disappearance alone is
 * not a close — coverage holes are common (PHASE4 D3 / §2.1).
 */
export function applyObservation(
  open: OpenSession | undefined,
  obs: Observation,
  gapMs = DEFAULT_SESSION_GAP_MS,
): { session: OpenSession; closed: OpenSession | null } {
  const callsign = normalizeCallsign(obs.callsign);
  const continues =
    open != null &&
    open.callsign === callsign &&
    obs.timeMs - open.endedAt <= gapMs;

  if (continues && open) {
    open.endedAt = Math.max(open.endedAt, obs.timeMs);
    open.pointCount += 1;
    expandBox(open, obs.latitude, obs.longitude);
    open.dirty = true;
    return { session: open, closed: null };
  }

  const next: OpenSession = {
    id: null,
    icao24: obs.icao24,
    callsign,
    startedAt: obs.timeMs,
    endedAt: obs.timeMs,
    pointCount: 1,
    minLat: obs.latitude,
    maxLat: obs.latitude,
    minLon: obs.longitude,
    maxLon: obs.longitude,
    dirty: true,
    isNew: true,
  };

  return { session: next, closed: open ?? null };
}

export function observationsFromStates(states: FlightState[]): Observation[] {
  return states.map((state) => ({
    icao24: state.icao24,
    callsign: state.callsign ?? null,
    timeMs: Date.parse(state.lastSeen),
    latitude: state.latitude,
    longitude: state.longitude,
  }));
}
