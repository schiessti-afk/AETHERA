import type { FastifyPluginAsync } from "fastify";
import { KEYS, type RedisClient } from "../modules/redis";
import { pool } from "../modules/postgres";
import type { FlightState } from "@aethera/types";

export const searchRoutes: FastifyPluginAsync<{ redis: RedisClient }> = async (
  app,
  opts,
) => {
  app.get<{ Querystring: { q?: string } }>("/api/search", async (request) => {
    const q = (request.query.q ?? "").trim();
    if (q.length < 2) {
      return { aircraft: [], airports: [] };
    }

    const needle = q.toUpperCase();
    const raw = await opts.redis.hGetAll(KEYS.state);
    const aircraft = Object.values(raw)
      .map((value) => JSON.parse(value) as FlightState)
      .filter(
        (flight) =>
          flight.icao24.toUpperCase().includes(needle) ||
          flight.callsign?.toUpperCase().includes(needle),
      )
      .slice(0, 20);

    const airports = await pool.query(
      `SELECT icao, iata, name, city, country, latitude, longitude
       FROM airports
       WHERE icao ILIKE $1 OR iata ILIKE $1 OR name ILIKE $1
       ORDER BY name
       LIMIT 20`,
      [`%${q}%`],
    );

    return { aircraft, airports: airports.rows };
  });
};
