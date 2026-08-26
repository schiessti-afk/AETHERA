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
