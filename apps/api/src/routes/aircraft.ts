import type { FastifyPluginAsync } from "fastify";
import type { AircraftMetadata, FlightState, SystemStats } from "@aethera/types";
import { aircraftQuerySchema, inBoundingBox } from "@aethera/validation";
import { KEYS, type RedisClient } from "../modules/redis";
import { pool } from "../modules/postgres";

function parseStates(raw: Record<string, string>): FlightState[] {
  const states: FlightState[] = [];
  for (const value of Object.values(raw)) {
    try {
      states.push(JSON.parse(value) as FlightState);
    } catch {
      // skip malformed entries
    }
  }
  return states;
}

export const aircraftRoutes: FastifyPluginAsync<{ redis: RedisClient }> = async (
  app,
  opts,
) => {
  app.get("/api/aircraft", async (request) => {
    const query = aircraftQuerySchema.parse(request.query);
    const raw = await opts.redis.hGetAll(KEYS.state);
    let aircraft = parseStates(raw);

    if (
      query.west != null &&
      query.south != null &&
      query.east != null &&
      query.north != null
    ) {
      const bounds = {
        west: query.west,
        south: query.south,
        east: query.east,
        north: query.north,
      };
      aircraft = aircraft.filter((flight) =>
        inBoundingBox(flight.latitude, flight.longitude, bounds),
      );
    }

    if (query.onGround != null) {
      aircraft = aircraft.filter((flight) => flight.onGround === query.onGround);
    }
    if (query.altitudeMin != null) {
      aircraft = aircraft.filter(
        (flight) => flight.altitude != null && flight.altitude >= query.altitudeMin!,
      );
    }
    if (query.altitudeMax != null) {
      aircraft = aircraft.filter(
        (flight) => flight.altitude != null && flight.altitude <= query.altitudeMax!,
      );
    }
    if (query.callsign) {
      const needle = query.callsign.toUpperCase();
      aircraft = aircraft.filter((flight) =>
        flight.callsign?.toUpperCase().includes(needle),
      );
    }
    if (query.squawk) {
      aircraft = aircraft.filter((flight) => flight.squawk === query.squawk);
    }

    return { aircraft, count: aircraft.length };
  });

  app.get<{ Params: { icao24: string } }>("/api/aircraft/:icao24", async (request, reply) => {
    const icao24 = request.params.icao24.toLowerCase();
    const raw = await opts.redis.hGet(KEYS.state, icao24);
    if (!raw) {
      return reply.code(404).send({ error: "Aircraft not currently observed" });
    }

    const state = JSON.parse(raw) as FlightState;

    // Registry metadata is strictly secondary to telemetry (§24.4) — if the lookup
    // fails, the observed state is still returned rather than failing the request.
    let metadata: AircraftMetadata | null = null;
    try {
      const result = await pool.query(
        `SELECT registration, type_code AS "typeCode", operator
           FROM aircraft WHERE icao24 = $1`,
        [icao24],
      );
      metadata = (result.rows[0] as AircraftMetadata | undefined) ?? null;
    } catch {
      metadata = null;
    }

    return { ...state, metadata };
  });

  app.get<{ Params: { icao24: string } }>(
    "/api/aircraft/:icao24/trail",
    async (request) => {
      // Positions recorded by ingestion from observed snapshots — never OpenSky /tracks,
      // which draws from a separate credit bucket reserved for History (ARCH §25.1).
      const raw = await opts.redis.lRange(
        `trail:${request.params.icao24.toLowerCase()}`,
        0,
        -1,
      );

      const points = raw
        .map((entry) => {
          const [lon, lat, alt, ts] = entry.split(",");
          const longitude = Number(lon);
          const latitude = Number(lat);
          const timestamp = Number(ts);
          if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
          return {
            longitude,
            latitude,
            altitude: alt === "" ? null : Number(alt),
            timestamp,
          };
        })
        .filter((p): p is NonNullable<typeof p> => p !== null);

      return { icao24: request.params.icao24.toLowerCase(), points, count: points.length };
    },
  );

  app.get("/api/stats", async () => {
    const raw = await opts.redis.hGetAll(KEYS.state);
    const aircraft = parseStates(raw);
    const meta = await opts.redis.hGetAll(KEYS.meta);
    const stats: SystemStats = {
      observed: aircraft.length,
      airborne: aircraft.filter((flight) => !flight.onGround).length,
      onGround: aircraft.filter((flight) => flight.onGround).length,
      lastUpdate: meta.lastSuccessAt ?? null,
      sourceTime: meta.sourceTime ?? null,
      creditsRemaining: meta.creditsRemaining != null ? Number(meta.creditsRemaining) : null,
      pollIntervalMs: meta.pollIntervalMs != null ? Number(meta.pollIntervalMs) : null,
      staleAfterMs: meta.staleAfterMs != null ? Number(meta.staleAfterMs) : null,
      lastError: meta.lastError ? meta.lastError : null,
    };
    return stats;
  });
};
