import type { FastifyPluginAsync } from "fastify";
import { KEYS, type RedisClient } from "../modules/redis";
import { pingDatabase } from "../modules/postgres";
import type { HealthStatus } from "@aethera/types";

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

    const unhealthy = Object.values(services).includes("unhealthy");
    const degraded = Object.values(services).includes("degraded");

    const body: HealthStatus = {
      status: unhealthy ? "unhealthy" : degraded ? "degraded" : "healthy",
      services,
      dataAgeSeconds,
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
