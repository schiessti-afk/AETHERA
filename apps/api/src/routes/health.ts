import type { FastifyPluginAsync } from "fastify";
import type { HealthStatus, HistoryHealth } from "@aethera/types";
import { KEYS, type RedisClient } from "../modules/redis";
import { pingDatabase, pool } from "../modules/postgres";

export const healthRoutes: FastifyPluginAsync<{ redis: RedisClient }> = async (
  app,
  opts,
) => {
  app.get("/health", async () => {
    const services: HealthStatus["services"] = {};

    try {
      await opts.redis.ping();
      services.redis = "healthy";
    } catch {
      services.redis = "unhealthy";
    }

    try {
      await pingDatabase();
      services.database = "healthy";
    } catch {
      services.database = "unhealthy";
    }

    const meta = await opts.redis.hGetAll(KEYS.meta).catch(() => ({} as Record<string, string>));
    const lastSuccessAt = meta.lastSuccessAt;
    const dataAgeSeconds = lastSuccessAt
      ? Math.max(0, (Date.now() - Date.parse(lastSuccessAt)) / 1000)
      : undefined;

    if (meta.lastError) {
      services.opensky = "degraded";
    } else if (lastSuccessAt) {
      services.opensky = dataAgeSeconds != null && dataAgeSeconds > 180 ? "degraded" : "healthy";
    } else {
      services.opensky = "degraded";
    }

    const history = await readHistoryHealth(meta, lastSuccessAt);
    services.history = history.service;

    const unhealthy = Object.values(services).includes("unhealthy");
    const degraded = Object.values(services).includes("degraded");

    const body: HealthStatus = {
      status: unhealthy ? "unhealthy" : degraded ? "degraded" : "healthy",
      services,
      dataAgeSeconds,
      history: history.body,
    };
    return body;
  });

  app.get("/ready", async (_request, reply) => {
    try {
      await opts.redis.ping();
      await pingDatabase();
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "not_ready" });
    }
  });
};

async function readHistoryHealth(
  meta: Record<string, string>,
  _lastSuccessAt: string | undefined,
): Promise<{ service: "healthy" | "degraded" | "unhealthy"; body: HistoryHealth }> {
  const retentionDays = Number(meta.historyRetentionDays ?? process.env.HISTORY_RETENTION_DAYS ?? 30);
  const lastFlushAt = meta.historyLastFlushAt || null;
  const lastFlushError = meta.historyLastFlushError || null;
  const lastFlushRows =
    meta.historyLastFlushRows != null && meta.historyLastFlushRows !== ""
      ? Number(meta.historyLastFlushRows)
      : null;

  let oldestHour: string | null = null;
  let newestHour: string | null = null;
  try {
    const result = await pool.query<{ oldest: Date | null; newest: Date | null }>(
      `SELECT MIN(hour_start) AS oldest, MAX(hour_start) AS newest FROM track_hours`,
    );
    oldestHour = result.rows[0]?.oldest?.toISOString() ?? null;
    newestHour = result.rows[0]?.newest?.toISOString() ?? null;
  } catch {
    // table may not exist yet
  }

  const body: HistoryHealth = {
    lastFlushAt,
    lastFlushRows: Number.isFinite(lastFlushRows) ? lastFlushRows : null,
    lastFlushError: lastFlushError || null,
    oldestHour,
    newestHour,
    retentionDays,
  };

  if (lastFlushError) {
    return { service: "degraded", body };
  }

  if (lastFlushAt) {
    const flushAge = Date.now() - Date.parse(lastFlushAt);
    if (Number.isFinite(flushAge) && flushAge > 2 * 60 * 60_000) {
      return { service: "degraded", body };
    }
  }

  return { service: "healthy", body };
}
