export interface TrackSample {
  time: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
}

export interface InterpolatedTrack {
  latitude: number;
  longitude: number;
  altitude: number | null;
  heading: number | undefined;
  velocity: number | undefined;
  interpolated: boolean;
  lastSeen: number;
}

/** Do not interpolate across a coverage hole longer than this. */
export const DEFAULT_TRACK_GAP_MS = 180_000;

const EARTH_RADIUS_M = 6_371_000;
const RAD = Math.PI / 180;

function bearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const y = Math.sin((lon2 - lon1) * RAD) * Math.cos(lat2 * RAD);
  const x =
    Math.cos(lat1 * RAD) * Math.sin(lat2 * RAD) -
    Math.sin(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.cos((lon2 - lon1) * RAD);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function wrapHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * RAD;
  const dLon = (lon2 - lon1) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function motion(
  a: TrackSample,
  b: TrackSample,
): { heading: number | undefined; velocity: number | undefined } {
  const dt = (b.time - a.time) / 1000;
  if (dt <= 0) return { heading: undefined, velocity: undefined };
  const dist = distanceM(a.latitude, a.longitude, b.latitude, b.longitude);
  if (dist < 1) return { heading: undefined, velocity: 0 };
  return {
    heading: wrapHeading(bearingDegrees(a.latitude, a.longitude, b.latitude, b.longitude)),
    velocity: dist / dt,
  };
}

/**
 * Position along a stored track at time `at`. Linear interpolation between the
 * surrounding observed points — an estimate, not a new observation. Gaps longer
 * than `maxGapMs` are not bridged: the last observation is held instead.
 */
export function interpolateTrack(
  points: TrackSample[],
  at: number,
  maxGapMs = DEFAULT_TRACK_GAP_MS,
): InterpolatedTrack | null {
  if (points.length === 0) return null;

  const first = points[0];
  const last = points[points.length - 1];
  if (at < first.time) return null;
  if (at > last.time + maxGapMs) return null;

  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].time <= at) lo = mid;
    else hi = mid - 1;
  }

  const prev = points[lo];
  const next = points[lo + 1];

  if (!next) {
    return {
      latitude: prev.latitude,
      longitude: prev.longitude,
      altitude: prev.altitude,
      heading: lo > 0 ? motion(points[lo - 1], prev).heading : undefined,
      velocity: lo > 0 ? motion(points[lo - 1], prev).velocity : undefined,
      interpolated: false,
      lastSeen: prev.time,
    };
  }

  const gap = next.time - prev.time;
  if (gap > maxGapMs || gap <= 0) {
    return {
      latitude: prev.latitude,
      longitude: prev.longitude,
      altitude: prev.altitude,
      heading: motion(prev, next).heading,
      velocity: undefined,
      interpolated: false,
      lastSeen: prev.time,
    };
  }

  if (at === prev.time) {
    const { heading, velocity } = motion(prev, next);
    return {
      latitude: prev.latitude,
      longitude: prev.longitude,
      altitude: prev.altitude,
      heading,
      velocity,
      interpolated: false,
      lastSeen: prev.time,
    };
  }

  const f = (at - prev.time) / gap;
  const { heading, velocity } = motion(prev, next);
  const altitude =
    prev.altitude != null && next.altitude != null
      ? prev.altitude + (next.altitude - prev.altitude) * f
      : (prev.altitude ?? next.altitude);

  return {
    latitude: prev.latitude + (next.latitude - prev.latitude) * f,
    longitude: prev.longitude + (next.longitude - prev.longitude) * f,
    altitude,
    heading,
    velocity,
    interpolated: true,
    lastSeen: prev.time,
  };
}
