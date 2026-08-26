import type { BoundingBox } from "@aethera/types";
import { OpenSkyProvider } from "../providers/opensky";
import { OpenSkyRateLimitError } from "../providers/rate-limit-error";
import { validateStates } from "../normalizer";
import { RedisPublisher } from "../publisher/redis";

export class Poller {
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private inFlight = false;

  constructor(
    private readonly provider: OpenSkyProvider,
    private readonly publisher: RedisPublisher,
    private readonly intervalMs: number,
    private readonly bounds?: BoundingBox,
  ) {}

  start(): void {
    this.stopped = false;
    void this.tick();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
    if (this.inFlight || this.stopped) return;
    this.inFlight = true;
    let nextDelay = this.intervalMs;
    try {
      const snapshot = await this.provider.fetchSnapshot(this.bounds);
      const states = validateStates(snapshot.states);
      await this.publisher.replaceSnapshot(states, snapshot.sourceTime, snapshot.creditsRemaining);
      const remaining =
        snapshot.creditsRemaining != null ? ` credits=${snapshot.creditsRemaining}` : "";
      console.log(`ingestion: stored ${states.length} observed aircraft${remaining}`);
    } catch (error) {
      if (error instanceof OpenSkyRateLimitError) {
        nextDelay = Math.max(this.intervalMs, error.retryAfterSeconds * 1000);
        console.warn(`ingestion: ${error.message}`);
        await this.publisher.recordFailure(error.message);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`ingestion: poll failed: ${message}`);
        await this.publisher.recordFailure(message);
      }
    } finally {
      this.inFlight = false;
      this.schedule(nextDelay);
    }
  }
}
