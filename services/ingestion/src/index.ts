import { createClient } from "redis";
import { Pool } from "pg";
import { config } from "./config";
import { OpenSkyProvider } from "./providers/opensky";
import { RedisPublisher } from "./publisher/redis";
import { Poller } from "./polling/poller";
import { KEYS } from "./publisher/redis";
import { AnomalyStore } from "./anomaly/store";
import { AnomalyDetector } from "./anomaly/detector";

async function main() {
  const redis = createClient({ url: config.redisUrl });
  redis.on("error", (error) => {
    console.error("ingestion redis error", error);
  });
  await redis.connect();

  await redis.hSet(KEYS.meta, "pollIntervalMs", String(config.pollIntervalMs));
  await redis.hSet(KEYS.meta, "staleAfterMs", String(config.staleAfterMs));

  // Anomaly history is durable; the live picture is not. If Postgres is unreachable the
  // detector still runs and still feeds Redis — only the history write is skipped.
  const pool = new Pool({ connectionString: config.databaseUrl, max: 4 });
  pool.on("error", (error) => {
    console.error("ingestion postgres error", error.message);
  });

  const provider = new OpenSkyProvider(config.openskyClientId, config.openskyClientSecret);
  const publisher = new RedisPublisher(redis, config.staleAfterMs);
  const detector = new AnomalyDetector(
    new AnomalyStore(redis, pool),
    publisher,
    config.anomalyThresholds,
  );
  const poller = new Poller(
    provider,
    publisher,
    config.pollIntervalMs,
    config.bounds,
    detector,
  );

  poller.start();
  const mode = config.openskyClientId && config.openskyClientSecret ? "oauth" : "anonymous";
  const coverage = config.bounds ? "bbox" : "global";
  console.log(
    `ingestion started (interval ${config.pollIntervalMs}ms, ${mode}, ${coverage}, ${config.creditCost} credits/poll, ${config.dailyCredits}/day)`,
  );

  const shutdown = async () => {
    poller.stop();
    await redis.quit();
    await pool.end().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
