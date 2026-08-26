import { createClient } from "redis";
import { config } from "../config";

export const KEYS = {
  state: "flights:state",
  active: "flights:active",
  meta: "ingestion:meta",
  events: "aethera:events",
} as const;

export type RedisClient = ReturnType<typeof createClient>;

export async function createRedis(): Promise<RedisClient> {
  const client = createClient({ url: config.redisUrl });
  client.on("error", (error) => {
    console.error("api redis error", error);
  });
  await client.connect();
  return client;
}
