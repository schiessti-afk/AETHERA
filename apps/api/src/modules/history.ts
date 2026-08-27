import type { BoundingBox, TrackHourExpanded, TrackPoint } from "@aethera/types";
import { expandHour, type PackedHour } from "@aethera/flight-engine";
import { inBoundingBox } from "@aethera/validation";

export const DEFAULT_PAGE_LIMIT = 400;
export const MAX_REGION_WINDOW_MS = 6 * 60 * 60_000;
export const MAX_AIRCRAFT_WINDOW_MS = 7 * 24 * 60 * 60_000;

export interface TrackHourRow {
  icao24: string;
  hour_start: Date;
  point_count: number;
  t_off: number[];
  lats: number[];
  lons: number[];
  alts: Array<number | null> | null;
}

export interface HistoryCursor {
  hourStart: string;
  icao24: string;
}

export function encodeCursor(cursor: HistoryCursor): string {
  return Buffer.from(JSON.stringify({ h: cursor.hourStart, i: cursor.icao24 }), "utf8").toString(
    "base64url",
  );
}

export function decodeCursor(raw: string | undefined): HistoryCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      h?: string;
      i?: string;
    };
    if (!parsed.h || !parsed.i) return null;
    return { hourStart: parsed.h, icao24: parsed.i };
  } catch {
    return null;
  }
}

export function parseWindow(
  from: string,
  to: string,
  maxMs: number,
): { fromMs: number; toMs: number; fromIso: string; toIso: string } {
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    throw Object.assign(new Error("Invalid time window"), { statusCode: 400 });
  }
  if (toMs - fromMs > maxMs) {
    throw Object.assign(new Error(`Window exceeds ${maxMs / 3_600_000} hours`), {
      statusCode: 400,
    });
  }
  return {
    fromMs,
    toMs,
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(toMs).toISOString(),
  };
}

function rowToPacked(row: TrackHourRow): PackedHour {
  return {
    icao24: row.icao24,
    hourStartMs: row.hour_start.getTime(),
    tOff: row.t_off ?? [],
    lats: row.lats ?? [],
    lons: row.lons ?? [],
    alts: row.alts ?? [],
    minLat: 0,
    maxLat: 0,
    minLon: 0,
    maxLon: 0,
    pointCount: row.point_count,
  };
}

export function expandRow(
  row: TrackHourRow,
  window: { fromMs: number; toMs: number },
  bounds?: BoundingBox,
): TrackHourExpanded | null {
  const observed = expandHour(rowToPacked(row), window);
  const points: TrackPoint[] = [];
  for (const point of observed) {
    if (bounds && !inBoundingBox(point.latitude, point.longitude, bounds)) continue;
    points.push({
      time: new Date(point.timeMs).toISOString(),
      latitude: point.latitude,
      longitude: point.longitude,
      altitude: point.altitude,
    });
  }
  if (points.length === 0) return null;
  return {
    icao24: row.icao24,
    hourStart: row.hour_start.toISOString(),
    points,
  };
}
