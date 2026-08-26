import type { FastifyPluginAsync } from "fastify";

export const anomalyRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/anomalies", async () => {
    return { anomalies: [] };
  });
};
