import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({ path: resolve(__dirname, "../../../.env") });

function readList(value: string | undefined, fallback: string): string[] {
  return (value ?? fallback)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export const config = {
  host: process.env.API_HOST ?? "0.0.0.0",
  port: Number(process.env.API_PORT ?? 3001),
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6380",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgres://aethera:aethera_password@localhost:55432/aethera",
  corsOrigins: readList(process.env.CORS_ORIGIN, "http://localhost:3000"),
  rateLimitMax: readPositiveInt(process.env.API_RATE_LIMIT_MAX, 120),
  rateLimitWindow: process.env.API_RATE_LIMIT_WINDOW ?? "1 minute",
  wsMaxConnections: readPositiveInt(process.env.WS_MAX_CONNECTIONS, 200),
  wsMaxConnectionsPerIp: readPositiveInt(process.env.WS_MAX_CONNECTIONS_PER_IP, 8),
};
