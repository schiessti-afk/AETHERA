import type { FastifyPluginAsync } from "fastify";
import { identityMatches, parseIdentityPattern } from "@aethera/flight-engine";
import {
  clampSearchQuery,
  escapeIlike,
  ILIKE_ESCAPE_SQL,
} from "@aethera/validation";
import { type RedisClient } from "../modules/redis";
import { liveAircraft } from "../modules/snapshot";
import { liveRegistry } from "../modules/registry";
import { pool } from "../modules/postgres";

export const searchRoutes: FastifyPluginAsync<{ redis: RedisClient }> = async (app) => {
  app.get<{ Querystring: { q?: string } }>(
    "/api/search",
    {
      config: {
        rateLimit: { max: 40, timeWindow: "1 minute" },
      },
    },
    async (request) => {
      const q = clampSearchQuery(request.query.q ?? "");
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

      const exact = escapeIlike(q);
      const contains = `%${exact}%`;
      const prefix = `${exact}%`;

      // Ranking matters now that the directory holds thousands of airports rather than a
      // seed of ten: ordering by name alone put "Groton New London Airport" above
      // Heathrow for the query "London". Exact codes win, then name matches over
      // incidental city matches, then the bigger airport.
      const airports = await pool.query(
        `SELECT icao, iata, name, city, country, latitude, longitude
         FROM airports
         WHERE icao ILIKE $1 ${ILIKE_ESCAPE_SQL}
            OR iata ILIKE $1 ${ILIKE_ESCAPE_SQL}
            OR name ILIKE $2 ${ILIKE_ESCAPE_SQL}
            OR city ILIKE $2 ${ILIKE_ESCAPE_SQL}
         ORDER BY
           CASE WHEN icao ILIKE $1 ${ILIKE_ESCAPE_SQL} OR iata ILIKE $1 ${ILIKE_ESCAPE_SQL} THEN 0 ELSE 1 END,
           CASE WHEN name ILIKE $3 ${ILIKE_ESCAPE_SQL} THEN 0 WHEN name ILIKE $2 ${ILIKE_ESCAPE_SQL} THEN 1 ELSE 2 END,
           CASE type
             WHEN 'large_airport' THEN 0
             WHEN 'medium_airport' THEN 1
             ELSE 2
           END,
           scheduled_service DESC,
           name
         LIMIT 20`,
        [exact, contains, prefix],
      );

      return { aircraft, airports: airports.rows };
    },
  );
};
