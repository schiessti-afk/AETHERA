import type { BoundingBox, FlightDataProvider, FlightState } from "@aethera/types";
import { ProviderRateLimitError } from "../providers/rate-limit-error";
import { validateStates } from "../normalizer";
import { RedisPublisher } from "../publisher/redis";
import type { AnomalyDetector } from "../anomaly/detector";
import type { AirspaceSampler } from "../analytics/sampler";
import type { TrackFlusher } from "../history/flusher";
import type { SessionTracker } from "../history/tracker";

export class Poller {
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private inFlight = false;

  constructor(
    private readonly provider: FlightDataProvider,
    private readonly publisher: RedisPublisher,
    private readonly intervalMs: number,
    private readonly bounds?: BoundingBox,
    private readonly detector?: AnomalyDetector,
    private readonly sampler?: AirspaceSampler,
    private readonly flusher?: TrackFlusher,
    private readonly sessions?: SessionTracker,
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

  /**
   * Applies a queued synthetic squawk to the incoming snapshot so the detection path
   * can be exercised without waiting for a real emergency. Development only, and the
   * request is consumed immediately so the condition resolves on the next poll.
   */
  private async applyTestInjection(states: FlightState[]): Promise<void> {
    if (process.env.NODE_ENV === "production") return;

    try {
      const raw = await this.publisher.takeTestInjection();
      if (!raw) return;
      const target = states.find((state) => state.icao24 === raw.icao24);
      if (!target) return;
      target.squawk = raw.squawk;
      console.warn(
        `ingestion: applied SYNTHETIC squawk ${raw.squawk} to ${raw.icao24} (test injection)`,
      );
    } catch {
      // never let a test hook disturb a real poll
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
    let statesForHistory: FlightState[] | null = null;
    try {
      const snapshot = await this.provider.fetchSnapshot(this.bounds);
      const states = validateStates(snapshot.states);
      await this.applyTestInjection(states);
      const { previous } = await this.publisher.mergeSnapshot(
        states,
        snapshot.sourceTime,
        this.provider.quotaRemaining(),
      );
      statesForHistory = states;
      const remaining = this.provider.quotaRemaining();
      const remainingLabel = remaining != null ? ` quota=${remaining}` : "";
      console.log(
        `ingestion: stored ${states.length} observed aircraft from ${this.provider.id}${remainingLabel}`,
      );

      // Detection runs after the snapshot is stored: a failure here must not cost us
      // the live picture, which is the product's primary obligation.
      let activeAnomalies = 0;
      if (this.detector) {
        try {
          activeAnomalies = await this.detector.run(states, previous);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`ingestion: anomaly detection failed: ${message}`);
        }
      }

      // Aggregate statistics are recorded after detection so the sample can carry the
      // anomaly count for that same moment.
      if (this.sampler) {
        await this.sampler.record(states, activeAnomalies);
      }
    } catch (error) {
      if (error instanceof ProviderRateLimitError) {
        nextDelay = Math.max(this.intervalMs, error.retryAfterSeconds * 1000);
        console.warn(`ingestion: ${error.message}`);
        await this.publisher.recordFailure(error.message);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`ingestion: poll failed: ${message}`);
        await this.publisher.recordFailure(message);
      }
      statesForHistory = null;
    } finally {
      this.inFlight = false;
      this.schedule(nextDelay);
    }

    // History persistence must not delay the next live poll — a long flush was
    // stretching lastSuccessAt past the client's LIVE threshold (DELAYED).
    if (statesForHistory) this.enqueueHistory(statesForHistory);
  }

  private historyQueued: FlightState[] | null = null;
  private historyBusy = false;

  private enqueueHistory(states: FlightState[]): void {
    this.historyQueued = states;
    void this.drainHistory();
  }

  private async drainHistory(): Promise<void> {
    if (this.historyBusy) return;
    this.historyBusy = true;
    try {
      while (this.historyQueued) {
        const states = this.historyQueued;
        this.historyQueued = null;
        if (this.sessions) {
          await this.sessions.observe(states);
        }
        if (this.flusher) {
          await this.flusher.maybeFlush();
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`ingestion: history persist failed: ${message}`);
    } finally {
      this.historyBusy = false;
      if (this.historyQueued) void this.drainHistory();
    }
  }
}
