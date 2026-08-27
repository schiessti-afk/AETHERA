import { z } from "zod";

export const boundingBoxSchema = z.object({
  west: z.number().min(-180).max(180),
  south: z.number().min(-90).max(90),
  east: z.number().min(-180).max(180),
  north: z.number().min(-90).max(90),
});

export const flightStateSchema = z.object({
  icao24: z.string().min(1),
  callsign: z.string().min(1).optional(),
  originCountry: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().optional(),
  geoAltitude: z.number().optional(),
  velocity: z.number().nonnegative().optional(),
  heading: z.number().min(0).max(360).optional(),
  verticalRate: z.number().optional(),
  squawk: z.string().optional(),
  onGround: z.boolean(),
  spi: z.boolean().optional(),
  lastSeen: z.string().min(1),
  receivedAt: z.string().min(1),
  processedAt: z.string().min(1),
});

export const aircraftQuerySchema = z.object({
  west: z.coerce.number().optional(),
  south: z.coerce.number().optional(),
  east: z.coerce.number().optional(),
  north: z.coerce.number().optional(),
  altitudeMin: z.coerce.number().optional(),
  altitudeMax: z.coerce.number().optional(),
  onGround: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (typeof value === "boolean") return value;
      return value === "true";
    }),
  callsign: z.string().optional(),
  squawk: z.string().optional(),
});

export const viewportSubscribeSchema = z.object({
  type: z.literal("viewport.subscribe"),
  bounds: boundingBoxSchema,
});

/**
 * A client declaring which aircraft it currently has selected or followed. This is what
 * scopes LOST_SIGNAL detection: globally, hundreds of airborne aircraft leave receiver
 * coverage every poll, so signal loss is only worth alerting on for an aircraft someone
 * is actually looking at.
 */
export const aircraftWatchSchema = z.object({
  type: z.literal("aircraft.watch"),
  icao24: z.string().min(1).max(12).nullable(),
});

const isoDate = z.string().min(1).refine((value) => Number.isFinite(Date.parse(value)), {
  message: "Invalid timestamp",
});

export const historyRegionQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  west: z.coerce.number(),
  south: z.coerce.number(),
  east: z.coerce.number(),
  north: z.coerce.number(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const historyAircraftQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const historySessionsQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  icao24: z.string().optional(),
  west: z.coerce.number().optional(),
  south: z.coerce.number().optional(),
  east: z.coerce.number().optional(),
  north: z.coerce.number().optional(),
});

export function isValidLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

export function inBoundingBox(
  latitude: number,
  longitude: number,
  bounds: { west: number; south: number; east: number; north: number },
): boolean {
  const { west, south, east, north } = bounds;
  const inLat = latitude >= south && latitude <= north;
  if (west <= east) {
    return inLat && longitude >= west && longitude <= east;
  }
  return inLat && (longitude >= west || longitude <= east);
}

/** Matches parseIdentityPattern's cap so search SQL and glob matching stay in lockstep. */
export const SEARCH_QUERY_MAX_LENGTH = 64;

/**
 * SQL fragment so `%` and `_` in user text stay literal under ILIKE.
 * PostgreSQL has no default LIKE escape; this sets it to backslash.
 */
export const ILIKE_ESCAPE_SQL = "ESCAPE E'\\\\'";

export function clampSearchQuery(raw: string): string {
  return raw.trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
}

/** Escape `\`, `%`, and `_` for use with {@link ILIKE_ESCAPE_SQL}. */
export function escapeIlike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
