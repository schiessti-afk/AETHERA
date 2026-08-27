import type { FastifyPluginAsync } from "fastify";
import type { AirspaceSample } from "@aethera/types";
import { summariseAirspace } from "@aethera/flight-engine";
import { inBoundingBox } from "@aethera/validation";
import { pool } from "../modules/postgres";
import { KEYS, type RedisClient } from "../modules/redis";
import { liveAircraft } from "../modules/snapshot";

const MAX_HISTORY_HOURS = 24;


export const analyticsRoutes: FastifyPluginAsync<{ redis: RedisClient }> = async (
  app,
  opts,
) => {
  /**
   * Current airspace composition.
   *
   * Computed server-side from the full Redis snapshot rather than from what a client
   * happens to have: the WebSocket feed is viewport-scoped, so deriving these numbers
   * in the browser would silently describe the visible rectangle while presenting
   * itself as the observed picture. An optional bbox makes that scoping explicit.
   */
  app.get<{ Querystring: { bbox?: string } }>("/api/analytics/summary", async (request) => {
    let flights = await liveAircraft();
    let scope: "global" | "region" = "global";

    if (request.query.bbox) {
      const [west, south, east, north] = request.query.bbox.split(",").map(Number);
      if ([west, south, east, north].every((v) => Number.isFinite(v))) {
        flights = flights.filter((f) =>
          inBoundingBox(f.latitude, f.longitude, { west, south, east, north }),
        );
        scope = "region";
      }
    }

    const activeAnomalies = await opts.redis
      .hLen(KEYS.anomaliesActive)
      .catch(() => 0);

    const summary = summariseAirspace(flights, { activeAnomalies });
    return { scope, summary };
  });

  /**
   * Retained aggregates over time. This is the only part of Analytics that is not
   * derived from the current instant, and it can only show what AETHERA has actually
   * been running to observe — there is no backfill.
   */
  app.get<{ Querystring: { hours?: string } }>("/api/analytics/history", async (request) => {
    const hours = Math.min(
      Math.max(Number(request.query.hours ?? 6), 1),
      MAX_HISTORY_HOURS,
    );

    try {
      const result = await pool.query(
        `SELECT observed_at   AS "observedAt",
                observed,
                airborne,
                on_ground     AS "onGround",
                climbing,
                descending,
                level,
                altitude_bands AS "altitudeBands",
                speed_bands    AS "speedBands",
                active_anomalies AS "activeAnomalies"
           FROM airspace_samples
          WHERE observed_at > now() - ($1 || ' hours')::interval
          ORDER BY observed_at ASC`,
        [String(hours)],
      );

      return {
        hours,
        samples: result.rows as AirspaceSample[],
        count: result.rowCount ?? 0,
      };
    } catch {
      // Analytics history is supporting material; its absence must not break the page.
      return { hours, samples: [], count: 0 };
    }
  });
};
