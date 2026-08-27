import type { FastifyPluginAsync } from "fastify";
import { liveRegistry } from "../modules/registry";

export const registryRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/api/registry",
    {
      config: { rateLimit: { max: 40, timeWindow: "1 minute" } },
    },
    async () => {
      const map = await liveRegistry();
      const index: Record<string, { typeCode: string | null; registration: string | null }> = {};
      for (const [icao24, entry] of map) {
        index[icao24] = entry;
      }
      return { index, count: map.size };
    },
  );
};
