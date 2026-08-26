import type { FastifyPluginAsync } from "fastify";
import type { FlightState, SystemStats } from "@aethera/types";
import { aircraftQuerySchema, inBoundingBox } from "@aethera/validation";
import { KEYS, type RedisClient } from "../modules/redis";

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
    const raw = await opts.redis.hGet(KEYS.state, request.params.icao24.toLowerCase());
    if (!raw) {
      return reply.code(404).send({ error: "Aircraft not currently observed" });
    }
    return JSON.parse(raw) as FlightState;
  });

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
