/**
 * Packed aircraft-hour encoding.
 *
 * Time is stored as seconds offset from hour_start (0..3599). REAL cannot
 * represent Unix epoch seconds: at ~1.79e9 its resolution is ~3100 s, which
 * silently shifts every replay timestamp (PHASE4 §2.4). Offsets in 0..3599
 * are exact in REAL.
 */

export interface ObservedTrackPoint {
  icao24: string;
  timeMs: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
}

export interface PackedHour {
  icao24: string;
  hourStartMs: number;
  tOff: number[];
  lats: number[];
  lons: number[];
  alts: Array<number | null>;
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  pointCount: number;
}

const HOUR_MS = 3_600_000;

/** UTC hour containing `epochMs`, as milliseconds since epoch. */
export function utcHourStartMs(epochMs: number): number {
  return Math.floor(epochMs / HOUR_MS) * HOUR_MS;
}

/** Seconds since `hourStartMs`. Range is 0..3599 for points inside that hour. */
export function secondsOffset(epochMs: number, hourStartMs: number): number {
  return (epochMs - hourStartMs) / 1000;
}

/**
 * Pack observed points that already share one aircraft-hour. Points outside
 * that hour are ignored. Returns null when nothing remains.
 */
export function packHour(points: ObservedTrackPoint[]): PackedHour | null {
  if (points.length === 0) return null;

  const icao24 = points[0].icao24;
  const hourStartMs = utcHourStartMs(points[0].timeMs);

  const tOff: number[] = [];
  const lats: number[] = [];
  const lons: number[] = [];
  const alts: Array<number | null> = [];

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const point of points) {
    if (point.icao24 !== icao24) continue;
    if (utcHourStartMs(point.timeMs) !== hourStartMs) continue;
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) continue;
    if (!Number.isFinite(point.timeMs)) continue;

    tOff.push(secondsOffset(point.timeMs, hourStartMs));
    lats.push(point.latitude);
    lons.push(point.longitude);
    alts.push(point.altitude != null && Number.isFinite(point.altitude) ? point.altitude : null);

    if (point.latitude < minLat) minLat = point.latitude;
    if (point.latitude > maxLat) maxLat = point.latitude;
    if (point.longitude < minLon) minLon = point.longitude;
    if (point.longitude > maxLon) maxLon = point.longitude;
  }

  if (tOff.length === 0) return null;

  return {
    icao24,
    hourStartMs,
    tOff,
    lats,
    lons,
    alts,
    minLat,
    maxLat,
    minLon,
    maxLon,
    pointCount: tOff.length,
  };
}

/** Group mixed-hour points into packed rows, one per (icao24, hour). */
export function packByHour(points: ObservedTrackPoint[]): PackedHour[] {
  const buckets = new Map<string, ObservedTrackPoint[]>();
  for (const point of points) {
    const key = `${point.icao24}:${utcHourStartMs(point.timeMs)}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(point);
    else buckets.set(key, [point]);
  }

  const packed: PackedHour[] = [];
  for (const bucket of buckets.values()) {
    const hour = packHour(bucket);
    if (hour) packed.push(hour);
  }
  return packed;
}

export function expandHour(
  packed: PackedHour,
  window?: { fromMs: number; toMs: number },
): ObservedTrackPoint[] {
  const points: ObservedTrackPoint[] = [];
  for (let i = 0; i < packed.tOff.length; i++) {
    const timeMs = packed.hourStartMs + packed.tOff[i] * 1000;
    if (window && (timeMs < window.fromMs || timeMs > window.toMs)) continue;
    points.push({
      icao24: packed.icao24,
      timeMs,
      latitude: packed.lats[i],
      longitude: packed.lons[i],
      altitude: packed.alts[i] ?? null,
    });
  }
  return points;
}
