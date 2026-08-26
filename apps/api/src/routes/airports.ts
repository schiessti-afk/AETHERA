import type { FastifyPluginAsync } from "fastify";
import type { Airport, FlightState } from "@aethera/types";
import { boundingBoxAround, distanceKm } from "@aethera/flight-engine";
import { inBoundingBox } from "@aethera/validation";
import { pool } from "../modules/postgres";
import { type RedisClient } from "../modules/redis";
import { liveAircraft } from "../modules/snapshot";

const M_TO_FT = 3.28084;
const MPS_TO_FPM = 196.85;

/** Default radius for "traffic around this airport", in kilometres. */
const DEFAULT_RADIUS_KM = 40;
const MAX_RADIUS_KM = 150;

/** Above this, an aircraft near an airport is passing over rather than using it. */
const OVERFLIGHT_FT = 15_000;
/** Vertical rate beyond which an aircraft counts as climbing or descending. */
const LEVEL_FPM = 300;

const AIRPORT_COLUMNS = `icao, iata, name, city, country, latitude, longitude,
  elevation_m AS elevation, type, scheduled_service AS "scheduledService"`;

/**
 * How an observed aircraft relates to an airport.
 *
 * These are geometric descriptions of what was observed, never claims about
 * scheduled operations. PRODUCT_SPEC §19.2: airport traffic means "observed aircraft
 * in a defined radius or approach volume — not official arrival/departure boards".
 * An aircraft descending near an airport may well be descending toward a different
 * one, so the wording downstream stays "descending nearby", not "arrival".
 */
export type TrafficRelation =
  | "on_ground"
  | "descending"
  | "climbing"
  | "level"
  | "overflight";

function classify(flight: FlightState, altitudeFt: number | null): TrafficRelation {
  if (flight.onGround) return "on_ground";
  if (altitudeFt != null && altitudeFt > OVERFLIGHT_FT) return "overflight";
  if (flight.verticalRate == null) return "level";
  const fpm = flight.verticalRate * MPS_TO_FPM;
  if (fpm < -LEVEL_FPM) return "descending";
  if (fpm > LEVEL_FPM) return "climbing";
  return "level";
}


export const airportRoutes: FastifyPluginAsync<{ redis: RedisClient }> = async (
  app,
  opts,
) => {
  app.get<{ Querystring: { q?: string; limit?: string; bbox?: string } }>(
    "/api/airports",
    async (request) => {
      const limit = Math.min(Number(request.query.limit ?? 100), 500);

      // Viewport query: which airports are on screen. Large fields first so that
      // zooming out thins the list down to the ones worth a marker (§19.3).
      if (request.query.bbox) {
        const [west, south, east, north] = request.query.bbox.split(",").map(Number);
        if ([west, south, east, north].some((v) => !Number.isFinite(v))) {
          return { airports: [] };
        }
        const result = await pool.query(
          `SELECT ${AIRPORT_COLUMNS} FROM airports
            WHERE latitude BETWEEN $1 AND $2
              AND longitude BETWEEN $3 AND $4
            ORDER BY CASE type
                       WHEN 'large_airport' THEN 0
                       WHEN 'medium_airport' THEN 1
                       ELSE 2
                     END,
                     scheduled_service DESC,
                     name
            LIMIT $5`,
          [south, north, west, east, limit],
        );
        return { airports: result.rows as Airport[] };
      }

      const q = (request.query.q ?? "").trim();
      if (q) {
        const result = await pool.query(
          `SELECT ${AIRPORT_COLUMNS} FROM airports
            WHERE icao ILIKE $1 OR iata ILIKE $1 OR name ILIKE $2 OR city ILIKE $2
            ORDER BY
              -- Exact code matches first, then bigger airports: someone typing "LHR"
              -- wants Heathrow, not every field whose name contains those letters.
              CASE WHEN icao ILIKE $1 OR iata ILIKE $1 THEN 0 ELSE 1 END,
              -- A name match beats an incidental city match: "London" should surface the
              -- London airports before King Phalo, which sits in East London, ZA.
              CASE WHEN name ILIKE $4 THEN 0 WHEN name ILIKE $2 THEN 1 ELSE 2 END,
              CASE type
                WHEN 'large_airport' THEN 0
                WHEN 'medium_airport' THEN 1
                ELSE 2
              END,
              scheduled_service DESC,
              name
            LIMIT $3`,
          [q, `%${q}%`, limit, `${q}%`],
        );
        return { airports: result.rows as Airport[] };
      }

      const result = await pool.query(
        `SELECT ${AIRPORT_COLUMNS} FROM airports
          WHERE type = 'large_airport'
          ORDER BY name
          LIMIT $1`,
        [limit],
      );
      return { airports: result.rows as Airport[] };
    },
  );

  app.get<{ Params: { icao: string } }>("/api/airports/:icao", async (request, reply) => {
    const result = await pool.query(
      `SELECT ${AIRPORT_COLUMNS} FROM airports WHERE icao = $1`,
      [request.params.icao.toUpperCase()],
    );
    if (!result.rowCount) {
      return reply.code(404).send({ error: "Airport not found" });
    }
    return result.rows[0] as Airport;
  });

  /**
   * Observed traffic around an airport, derived entirely from AETHERA's own live
   * snapshot. This deliberately does not call OpenSky /flights: that endpoint has its
   * own separate credit bucket reserved for History (ARCHITECTURE §25.1), and the
   * product does not claim arrival/departure boards in the first place (§19.2).
   */
  app.get<{ Params: { icao: string }; Querystring: { radius?: string } }>(
    "/api/airports/:icao/traffic",
    async (request, reply) => {
      const airportResult = await pool.query(
        `SELECT ${AIRPORT_COLUMNS} FROM airports WHERE icao = $1`,
        [request.params.icao.toUpperCase()],
      );
      if (!airportResult.rowCount) {
        return reply.code(404).send({ error: "Airport not found" });
      }
      const airport = airportResult.rows[0] as Airport;

      const radiusKm = Math.min(
        Math.max(Number(request.query.radius ?? DEFAULT_RADIUS_KM), 1),
        MAX_RADIUS_KM,
      );

      const box = boundingBoxAround(airport.latitude, airport.longitude, radiusKm);

      // Reject the bulk of a ~12,000-aircraft snapshot with a cheap box test before
      // paying for great-circle distance on the remainder.
      const nearby = (await liveAircraft())
        .filter((flight) => inBoundingBox(flight.latitude, flight.longitude, box))
        .map((flight) => ({
          flight,
          distanceKm: distanceKm(
            airport.latitude,
            airport.longitude,
            flight.latitude,
            flight.longitude,
          ),
        }))
        .filter((entry) => entry.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

      const counts: Record<TrafficRelation, number> = {
        on_ground: 0,
        descending: 0,
        climbing: 0,
        level: 0,
        overflight: 0,
      };

      const traffic = nearby.map(({ flight, distanceKm: km }) => {
        const altitudeFt =
          flight.altitude != null ? Math.round(flight.altitude * M_TO_FT) : null;
        const relation = classify(flight, altitudeFt);
        counts[relation] += 1;
        return {
          icao24: flight.icao24,
          callsign: flight.callsign ?? null,
          latitude: flight.latitude,
          longitude: flight.longitude,
          altitudeFt,
          relation,
          distanceKm: Math.round(km * 10) / 10,
          lastSeen: flight.lastSeen,
        };
      });

      return {
        airport,
        radiusKm,
        counts,
        total: traffic.length,
        traffic: traffic.slice(0, 200),
      };
    },
  );
};
