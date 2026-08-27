import type { FastifyPluginAsync } from "fastify";
import type { BoundingBox, FlightSession, HistorySummary } from "@aethera/types";
import {
  historyAircraftQuerySchema,
  historyRegionQuerySchema,
  historySessionsQuerySchema,
} from "@aethera/validation";
import { pool } from "../modules/postgres";
import {
  DEFAULT_PAGE_LIMIT,
  MAX_AIRCRAFT_WINDOW_MS,
  MAX_REGION_WINDOW_MS,
  decodeCursor,
  encodeCursor,
  expandRow,
  parseWindow,
  type TrackHourRow,
} from "../modules/history";

const RETENTION_DAYS = Number(process.env.HISTORY_RETENTION_DAYS ?? 30);

const HOUR_COLUMNS = `icao24, hour_start, point_count, t_off, lats, lons, alts`;

export const historyRoutes: FastifyPluginAsync = async (app) => {
  /**
   * How much history exists in a window. Cheap enough to call before loading
   * tracks, and the empty-history UI reads this rather than treating zero pages
   * as a failure.
   */
  app.get("/api/history/summary", async (request, reply) => {
    const query = historyRegionQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid history query" });

    let window;
    try {
      window = parseWindow(query.data.from, query.data.to, MAX_REGION_WINDOW_MS);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid window" });
    }

    const bounds = boundsFrom(query.data);
    try {
      const result = await pool.query<{
        aircraft_count: string;
        point_count: string;
        hour_count: string;
        earliest: Date | null;
        latest: Date | null;
      }>(
        `SELECT COUNT(DISTINCT icao24)::text AS aircraft_count,
                COALESCE(SUM(point_count), 0)::text AS point_count,
                COUNT(*)::text AS hour_count,
                MIN(hour_start) AS earliest,
                MAX(hour_start) AS latest
           FROM track_hours
          WHERE hour_start >= $1::timestamptz - interval '1 hour'
            AND hour_start <= $2::timestamptz
            AND box(point(min_lon, min_lat), point(max_lon, max_lat))
                && box(point($3, $4), point($5, $6))`,
        [window.fromIso, window.toIso, bounds.west, bounds.south, bounds.east, bounds.north],
      );

      const row = result.rows[0];
      const body: HistorySummary = {
        from: window.fromIso,
        to: window.toIso,
        aircraftCount: Number(row?.aircraft_count ?? 0),
        pointCount: Number(row?.point_count ?? 0),
        hourCount: Number(row?.hour_count ?? 0),
        earliest: row?.earliest?.toISOString() ?? null,
        latest: row?.latest?.toISOString() ?? null,
        retentionDays: RETENTION_DAYS,
      };
      return body;
    } catch {
      return {
        from: window.fromIso,
        to: window.toIso,
        aircraftCount: 0,
        pointCount: 0,
        hourCount: 0,
        earliest: null,
        latest: null,
        retentionDays: RETENTION_DAYS,
      };
    }
  });

  /**
   * Region + time window. Packed rows stay packed in SQL; expansion happens here.
   * Paged by (hour_start, icao24) so a busy Europe hour does not become one payload.
   */
  app.get("/api/history/region", async (request, reply) => {
    const query = historyRegionQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid history query" });

    let window;
    try {
      window = parseWindow(query.data.from, query.data.to, MAX_REGION_WINDOW_MS);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid window" });
    }

    const bounds = boundsFrom(query.data);
    const limit = query.data.limit ?? DEFAULT_PAGE_LIMIT;
    const cursor = decodeCursor(query.data.cursor);

    const params: unknown[] = [
      window.fromIso,
      window.toIso,
      bounds.west,
      bounds.south,
      bounds.east,
      bounds.north,
      limit + 1,
    ];
    let cursorClause = "";
    if (cursor) {
      params.push(cursor.hourStart, cursor.icao24);
      cursorClause = `AND (hour_start, icao24) > ($8::timestamptz, $9)`;
    }

    try {
      const result = await pool.query<TrackHourRow>(
        `SELECT ${HOUR_COLUMNS}
           FROM track_hours
          WHERE hour_start >= $1::timestamptz - interval '1 hour'
            AND hour_start <= $2::timestamptz
            AND box(point(min_lon, min_lat), point(max_lon, max_lat))
                && box(point($3, $4), point($5, $6))
            ${cursorClause}
          ORDER BY hour_start, icao24
          LIMIT $7`,
        params,
      );

      const hasMore = result.rows.length > limit;
      const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
      const hours = rows
        .map((row) => expandRow(row, window, bounds))
        .filter((hour): hour is NonNullable<typeof hour> => hour != null);

      const last = rows[rows.length - 1];
      return {
        from: window.fromIso,
        to: window.toIso,
        bounds,
        hours,
        count: hours.length,
        nextCursor:
          hasMore && last
            ? encodeCursor({ hourStart: last.hour_start.toISOString(), icao24: last.icao24 })
            : null,
      };
    } catch {
      return {
        from: window.fromIso,
        to: window.toIso,
        bounds,
        hours: [],
        count: 0,
        nextCursor: null,
      };
    }
  });

  app.get<{ Params: { icao24: string } }>("/api/history/aircraft/:icao24", async (request, reply) => {
    const query = historyAircraftQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid history query" });

    let window;
    try {
      window = parseWindow(query.data.from, query.data.to, MAX_AIRCRAFT_WINDOW_MS);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid window" });
    }

    const icao24 = request.params.icao24.toLowerCase();
    const limit = query.data.limit ?? DEFAULT_PAGE_LIMIT;
    const cursor = decodeCursor(query.data.cursor);

    const params: unknown[] = [icao24, window.fromIso, window.toIso, limit + 1];
    let cursorClause = "";
    if (cursor) {
      params.push(cursor.hourStart);
      cursorClause = `AND hour_start > $5::timestamptz`;
    }

    const result = await pool.query<TrackHourRow>(
      `SELECT ${HOUR_COLUMNS}
         FROM track_hours
        WHERE icao24 = $1
          AND hour_start >= $2::timestamptz - interval '1 hour'
          AND hour_start <= $3::timestamptz
          ${cursorClause}
        ORDER BY hour_start
        LIMIT $4`,
      params,
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
    const hours = rows
      .map((row) => expandRow(row, window))
      .filter((hour): hour is NonNullable<typeof hour> => hour != null);

    const last = rows[rows.length - 1];
    return {
      icao24,
      from: window.fromIso,
      to: window.toIso,
      hours,
      count: hours.length,
      nextCursor:
        hasMore && last
          ? encodeCursor({ hourStart: last.hour_start.toISOString(), icao24 })
          : null,
    };
  });

  /**
   * Inferred sessions covering the window. Always labelled derived — session
   * boundaries are a model, not an observation (PHASE4 D3).
   */
  app.get("/api/history/sessions", async (request, reply) => {
    const query = historySessionsQuerySchema.safeParse(request.query);
    if (!query.success) return reply.code(400).send({ error: "Invalid history query" });

    let window;
    try {
      window = parseWindow(query.data.from, query.data.to, MAX_AIRCRAFT_WINDOW_MS);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid window" });
    }

    const params: unknown[] = [window.fromIso, window.toIso];
    const filters: string[] = [
      `started_at <= $2::timestamptz`,
      `COALESCE(ended_at, started_at) >= $1::timestamptz`,
    ];

    if (query.data.icao24) {
      params.push(query.data.icao24.toLowerCase());
      filters.push(`icao24 = $${params.length}`);
    }

    if (
      query.data.west != null &&
      query.data.south != null &&
      query.data.east != null &&
      query.data.north != null
    ) {
      params.push(query.data.west, query.data.south, query.data.east, query.data.north);
      const i = params.length - 3;
      filters.push(
        `min_lon IS NOT NULL AND box(point(min_lon, min_lat), point(max_lon, max_lat))
           && box(point($${i}, $${i + 1}), point($${i + 2}, $${i + 3}))`,
      );
    }

    const result = await pool.query<{
      id: string;
      icao24: string;
      callsign: string | null;
      started_at: Date;
      ended_at: Date | null;
      point_count: number;
      min_lat: number | null;
      max_lat: number | null;
      min_lon: number | null;
      max_lon: number | null;
    }>(
      `SELECT id, icao24, callsign, started_at, ended_at, point_count,
              min_lat, max_lat, min_lon, max_lon
         FROM flight_sessions
        WHERE ${filters.join(" AND ")}
        ORDER BY started_at DESC
        LIMIT 2000`,
      params,
    );

    const sessions: FlightSession[] = result.rows.map((row) => ({
      id: Number(row.id),
      icao24: row.icao24,
      callsign: row.callsign,
      startedAt: row.started_at.toISOString(),
      endedAt: row.ended_at?.toISOString() ?? null,
      pointCount: row.point_count,
      minLat: row.min_lat,
      maxLat: row.max_lat,
      minLon: row.min_lon,
      maxLon: row.max_lon,
      inferred: true,
    }));

    return { sessions, count: sessions.length };
  });
};

function boundsFrom(query: { west: number; south: number; east: number; north: number }): BoundingBox {
  return { west: query.west, south: query.south, east: query.east, north: query.north };
}
