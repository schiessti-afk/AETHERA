import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { config } from "./config";
import { createRedis } from "./modules/redis";
import { createSnapshotCache } from "./modules/snapshot";
import { healthRoutes } from "./routes/health";
import { aircraftRoutes } from "./routes/aircraft";
import { airportRoutes } from "./routes/airports";
import { searchRoutes } from "./routes/search";
import { anomalyRoutes } from "./routes/anomalies";
import { analyticsRoutes } from "./routes/analytics";
import { historyRoutes } from "./routes/history";
import { registryRoutes } from "./routes/registry";
import { websocketRoutes } from "./websocket/gateway";

async function main() {
  const redis = await createRedis();
  createSnapshotCache(redis);
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: config.corsOrigin });
  await app.register(websocket);

  await app.register(healthRoutes, { redis });
  await app.register(aircraftRoutes, { redis });
  await app.register(airportRoutes, { redis });
  await app.register(searchRoutes, { redis });
  await app.register(anomalyRoutes, { redis });
  await app.register(analyticsRoutes, { redis });
  await app.register(historyRoutes);
  await app.register(registryRoutes);
  await app.register(websocketRoutes, { redis });

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

main();
