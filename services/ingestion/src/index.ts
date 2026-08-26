import { createClient } from "redis";
import { config } from "./config";
import { OpenSkyProvider } from "./providers/opensky";
import { RedisPublisher } from "./publisher/redis";
import { Poller } from "./polling/poller";

async function main() {
  const redis = createClient({ url: config.redisUrl });
  redis.on("error", (error) => {
    console.error("ingestion redis error", error);
  });
  await redis.connect();

  const provider = new OpenSkyProvider(config.openskyClientId, config.openskyClientSecret);
  const publisher = new RedisPublisher(redis);
  const poller = new Poller(provider, publisher, config.pollIntervalMs, config.bounds);

  poller.start();
  const mode = config.openskyClientId && config.openskyClientSecret ? "oauth" : "anonymous";
  const coverage = config.bounds ? "bbox" : "global";
  console.log(
    `ingestion started (interval ${config.pollIntervalMs}ms, ${mode}, ${coverage}, ${config.creditCost} credits/poll, ${config.dailyCredits}/day)`,
  );

  const shutdown = async () => {
    poller.stop();
    await redis.quit();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
