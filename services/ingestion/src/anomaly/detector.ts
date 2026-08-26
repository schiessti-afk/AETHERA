import type { FlightState } from "@aethera/types";
import { evaluateSnapshot, type AnomalyThresholds } from "@aethera/anomaly-engine";
import type { AnomalyStore } from "./store";
import type { RedisPublisher } from "../publisher/redis";

/**
 * Runs anomaly detection for one poll cycle.
 *
 * Detection lives in ingestion because this is the only place that holds both the
 * previous and the incoming snapshot at the moment one arrives — anywhere else would
 * have to re-derive that. It also keeps the MVP service list unchanged
 * (ARCHITECTURE §41: web, api, ingestion, postgres, redis; no anomaly service).
 */
export class AnomalyDetector {
  constructor(
    private readonly store: AnomalyStore,
    private readonly publisher: RedisPublisher,
    private readonly thresholds: Partial<AnomalyThresholds>,
  ) {}

  async run(flights: FlightState[], previous: FlightState[]): Promise<void> {
    const state = await this.store.loadState();

    const result = evaluateSnapshot({
      flights,
      previous,
      active: state.active,
      lastDetected: state.lastDetected,
      watched: state.watched,
      thresholds: this.thresholds,
    });

    await this.store.commit({
      active: result.active,
      lastDetected: result.lastDetected,
      detected: result.detected,
      resolved: result.resolved,
    });

    await this.publisher.publishAnomalies(result.detected, result.resolved);

    if (result.detected.length > 0 || result.resolved.length > 0) {
      console.log(
        `ingestion: anomalies +${result.detected.length} -${result.resolved.length} ` +
          `(${Object.keys(result.active).length} active)`,
      );
    }
  }
}
