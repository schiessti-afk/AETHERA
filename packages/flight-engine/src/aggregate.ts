import type { AirspaceSample, BandHistogram, FlightState } from "@aethera/types";

const M_TO_FT = 3.28084;
const MPS_TO_KT = 1.94384;
const MPS_TO_FPM = 196.85;

/** Vertical rate within this band reads as holding level rather than climbing. */
export const LEVEL_FPM = 300;

/**
 * Altitude band lower bounds in feet. Chosen against real traffic rather than round
 * numbers for their own sake: an observed global snapshot is strongly bimodal, with a
 * cruise mass above 30,000 ft and a second concentration between 1,000 and 5,000 ft
 * around airports. Uniform 5,000 ft bins would flatten both into noise.
 */
export const ALTITUDE_BANDS_FT = [0, 1_000, 5_000, 10_000, 20_000, 30_000, 40_000];

/** Ground-speed band lower bounds in knots. */
export const SPEED_BANDS_KT = [0, 100, 200, 300, 400, 500, 600];

function bandFor(value: number, bounds: readonly number[]): string {
  let chosen = bounds[0];
  for (const bound of bounds) {
    if (value >= bound) chosen = bound;
    else break;
  }
  return String(chosen);
}

function emptyHistogram(bounds: readonly number[]): BandHistogram {
  return Object.fromEntries(bounds.map((bound) => [String(bound), 0]));
}

/**
 * Reduces a snapshot to the aggregate shape Analytics reads.
 *
 * Aircraft with an unreported altitude or vertical rate are simply not counted in the
 * band they cannot be placed in, rather than being defaulted into one — an unknown
 * value is not a zero (PRODUCT_SPEC §12.3), and silently binning it as "0-1000 ft"
 * would invent structure that was never observed.
 */
export function summariseAirspace(
  flights: FlightState[],
  options: { observedAt?: string; activeAnomalies?: number } = {},
): AirspaceSample {
  const altitudeBands = emptyHistogram(ALTITUDE_BANDS_FT);
  const speedBands = emptyHistogram(SPEED_BANDS_KT);

  let airborne = 0;
  let onGround = 0;
  let climbing = 0;
  let descending = 0;
  let level = 0;

  for (const flight of flights) {
    if (flight.onGround) {
      onGround += 1;
    } else {
      airborne += 1;

      if (flight.verticalRate != null) {
        const fpm = flight.verticalRate * MPS_TO_FPM;
        if (fpm > LEVEL_FPM) climbing += 1;
        else if (fpm < -LEVEL_FPM) descending += 1;
        else level += 1;
      }

      if (flight.altitude != null) {
        const key = bandFor(flight.altitude * M_TO_FT, ALTITUDE_BANDS_FT);
        altitudeBands[key] += 1;
      }
    }

    if (flight.velocity != null) {
      const key = bandFor(flight.velocity * MPS_TO_KT, SPEED_BANDS_KT);
      speedBands[key] += 1;
    }
  }

  return {
    observedAt: options.observedAt ?? new Date().toISOString(),
    observed: flights.length,
    airborne,
    onGround,
    climbing,
    descending,
    level,
    altitudeBands,
    speedBands,
    activeAnomalies: options.activeAnomalies ?? 0,
  };
}
