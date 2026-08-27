import type { FastifyPluginAsync } from "fastify";
import { identityMatches, parseIdentityPattern } from "@aethera/flight-engine";
import { type RedisClient } from "../modules/redis";
import { liveAircraft } from "../modules/snapshot";
import { liveRegistry } from "../modules/registry";
import { pool } from "../modules/postgres";

export const searchRoutes: FastifyPluginAsync<{ redis: RedisClient }> = async (app) => {
  app.get<{ Querystring: { q?: string } }>("/api/search", async (request) => {
    const q = (request.query.q ?? "").trim();
    if (q.length < 2) {
      return { aircraft: [], airports: [] };
    }

    const pattern = parseIdentityPattern(q);
    const registry = await liveRegistry();
    const aircraft = (await liveAircraft())
      .filter((flight) =>
        identityMatches(pattern, [
          flight.icao24,
          flight.callsign,
          registry.get(flight.icao24)?.registration,
        ]),
      )
      .slice(0, 20)
      .map((flight) => ({
        ...flight,
        registration: registry.get(flight.icao24)?.registration ?? null,
        typeCode: registry.get(flight.icao24)?.typeCode ?? null,
      }));

    // Ranking matters now that the directory holds thousands of airports rather than a
    // seed of ten: ordering by name alone put "Groton New London Airport" above
    // Heathrow for the query "London". Exact codes win, then name matches over
    // incidental city matches, then the bigger airport.
    const airports = await pool.query(
      `SELECT icao, iata, name, city, country, latitude, longitude
       FROM airports
       WHERE icao ILIKE $1 OR iata ILIKE $1 OR name ILIKE $2 OR city ILIKE $2
       ORDER BY
         CASE WHEN icao ILIKE $1 OR iata ILIKE $1 THEN 0 ELSE 1 END,
         CASE WHEN name ILIKE $3 THEN 0 WHEN name ILIKE $2 THEN 1 ELSE 2 END,
         CASE type
           WHEN 'large_airport' THEN 0
           WHEN 'medium_airport' THEN 1
           ELSE 2
         END,
         scheduled_service DESC,
         name
       LIMIT 20`,
      [q, `%${q}%`, `${q}%`],
    );

    return { aircraft, airports: airports.rows };
  });
};
