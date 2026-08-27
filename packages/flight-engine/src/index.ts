import type { FlightState } from "@aethera/types";
import { flightStateSchema, inBoundingBox } from "@aethera/validation";
import type { BoundingBox } from "@aethera/types";

const EARTH_RADIUS_M = 6_371_000;
/**
 * How long dead-reckoning is trusted before a position stops advancing.
 * Matches the ~90-120s OpenSky poll cadence so motion stays continuous
 * between snapshots instead of freezing well before the next one arrives.
 */
const DEFAULT_MAX_EXTRAPOLATION_S = 120;
/** Past this age, a marker should read as stale rather than confidently live. */
export const STALE_AFTER_S = 180;
/** Past this age, an aircraft should be removed from the scene entirely. */
export const REMOVE_AFTER_S = 300;

export class FlightStore {
  private flights = new Map<string, FlightState>();

  upsert(state: FlightState): { created: boolean } {
    const created = !this.flights.has(state.icao24);
    this.flights.set(state.icao24, state);
    return { created };
  }

  get(icao24: string): FlightState | undefined {
    return this.flights.get(icao24);
  }

  getAll(): FlightState[] {
    return Array.from(this.flights.values());
  }

  inBounds(bounds: BoundingBox): FlightState[] {
    return this.getAll().filter((flight) =>
      inBoundingBox(flight.latitude, flight.longitude, bounds),
    );
  }

  remove(icao24: string): boolean {
    return this.flights.delete(icao24);
  }

  removeStale(thresholdMs: number, now = Date.now()): number {
    let removed = 0;
    for (const [icao24, flight] of this.flights) {
      if (now - Date.parse(flight.lastSeen) > thresholdMs) {
        this.flights.delete(icao24);
        removed += 1;
      }
    }
    return removed;
  }
}

export function parseFlightState(input: unknown): FlightState | null {
  const result = flightStateSchema.safeParse(input);
  return result.success ? result.data : null;
}

export function interpolatePosition(
  state: FlightState,
  now = Date.now(),
  maxExtrapolationS = DEFAULT_MAX_EXTRAPOLATION_S,
): { latitude: number; longitude: number; interpolated: boolean } {
  if (state.onGround || state.velocity == null || state.heading == null) {
    return { latitude: state.latitude, longitude: state.longitude, interpolated: false };
  }

  const elapsedS = (now - Date.parse(state.lastSeen)) / 1000;
  if (!Number.isFinite(elapsedS) || elapsedS <= 0) {
    return { latitude: state.latitude, longitude: state.longitude, interpolated: false };
  }

  const dt = Math.min(elapsedS, maxExtrapolationS);
  const distanceM = state.velocity * dt;
  const headingRad = (state.heading * Math.PI) / 180;
  const latRad = (state.latitude * Math.PI) / 180;

  const dLat = (distanceM * Math.cos(headingRad)) / EARTH_RADIUS_M;
  const dLon =
    (distanceM * Math.sin(headingRad)) / (EARTH_RADIUS_M * Math.cos(latRad));

  return {
    latitude: state.latitude + (dLat * 180) / Math.PI,
    longitude: state.longitude + (dLon * 180) / Math.PI,
    interpolated: true,
  };
}

export function dataAgeSeconds(lastSeen: string, now = Date.now()): number {
  return Math.max(0, (now - Date.parse(lastSeen)) / 1000);
}

export type MarkerFreshness = "live" | "aging" | "stale";

/** Live until STALE_AFTER_S, then stale until REMOVE_AFTER_S, then gone. */
export function markerFreshness(ageSeconds: number): MarkerFreshness {
  if (ageSeconds <= STALE_AFTER_S) return "live";
  return "stale";
}

/**
 * 1 at a fresh observation, fading to 0 by STALE_AFTER_S. Drives marker
 * opacity so extrapolated confidence decays visibly instead of a hard freeze.
 */
export function positionConfidence(ageSeconds: number): number {
  if (ageSeconds <= 0) return 1;
  if (ageSeconds >= STALE_AFTER_S) return 0.35;
  return 1 - 0.65 * (ageSeconds / STALE_AFTER_S);
}
export { distanceKm, boundingBoxAround } from "./geo";
export {
  summariseAirspace,
  ALTITUDE_BANDS_FT,
  SPEED_BANDS_KT,
  LEVEL_FPM,
} from "./aggregate";
export {
  utcHourStartMs,
  secondsOffset,
  packHour,
  packByHour,
  expandHour,
  type ObservedTrackPoint,
  type PackedHour,
} from "./track-pack";
export {
  interpolateTrack,
  DEFAULT_TRACK_GAP_MS,
  type TrackSample,
  type InterpolatedTrack,
} from "./track-interpolate";
