import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(__dirname, "../../../.env") });

export const config = {
  host: process.env.API_HOST ?? "0.0.0.0",
  port: Number(process.env.API_PORT ?? 3001),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6380",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://aethera:aethera_password@localhost:55432/aethera",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};
