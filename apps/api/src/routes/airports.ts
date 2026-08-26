import type { FastifyPluginAsync } from "fastify";
import { pool } from "../modules/postgres";

export const airportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/airports", async () => {
    const result = await pool.query(
      `SELECT icao, iata, name, city, country, latitude, longitude, elevation_m AS elevation
       FROM airports
       ORDER BY name`,
    );
    return { airports: result.rows };
  });

  app.get<{ Params: { icao: string } }>("/api/airports/:icao", async (request, reply) => {
    const result = await pool.query(
      `SELECT icao, iata, name, city, country, latitude, longitude, elevation_m AS elevation
       FROM airports
       WHERE icao = $1`,
      [request.params.icao.toUpperCase()],
    );
    if (!result.rowCount) {
      return reply.code(404).send({ error: "Airport not found" });
    }
    return result.rows[0];
  });
};
