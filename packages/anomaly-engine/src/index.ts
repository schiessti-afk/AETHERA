import type { Anomaly, AnomalyType, FlightState } from "@aethera/types";

const EMERGENCY_SQUAWKS = new Set(["7500", "7600", "7700"]);
const RAPID_DESCENT_MPS = -5.08; // ~-1000 fpm
const RAPID_CLIMB_MPS = 10.16; // ~2000 fpm

function idFor(icao24: string, type: AnomalyType): string {
  return `${icao24}:${type}`;
}

export class AnomalyEngine {
  private active = new Map<string, Anomaly>();

  evaluate(flights: FlightState[], now = new Date().toISOString()): Anomaly[] {
    const seen = new Set<string>();
    const detected: Anomaly[] = [];

    for (const flight of flights) {
      const candidates = detectForFlight(flight, now);
      for (const anomaly of candidates) {
        const key = idFor(anomaly.icao24, anomaly.type);
        seen.add(key);
        if (!this.active.has(key)) {
          this.active.set(key, anomaly);
          detected.push(anomaly);
        }
      }
    }

    for (const key of Array.from(this.active.keys())) {
      if (!seen.has(key)) {
        const current = this.active.get(key);
        if (current && !current.resolvedAt) {
          current.resolvedAt = now;
        }
        this.active.delete(key);
      }
    }

    return detected;
  }

  getActive(): Anomaly[] {
    return Array.from(this.active.values());
  }
}

export function detectForFlight(flight: FlightState, now: string): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (flight.squawk && EMERGENCY_SQUAWKS.has(flight.squawk)) {
    anomalies.push({
      id: idFor(flight.icao24, "EMERGENCY_SQUAWK"),
      type: "EMERGENCY_SQUAWK",
      severity: "critical",
      icao24: flight.icao24,
      timestamp: now,
      value: flight.squawk,
    });
  }

  if (flight.verticalRate != null && flight.verticalRate < RAPID_DESCENT_MPS) {
    anomalies.push({
      id: idFor(flight.icao24, "RAPID_DESCENT"),
      type: "RAPID_DESCENT",
      severity: "high",
      icao24: flight.icao24,
      timestamp: now,
      value: flight.verticalRate,
    });
  }

  if (flight.verticalRate != null && flight.verticalRate > RAPID_CLIMB_MPS) {
    anomalies.push({
      id: idFor(flight.icao24, "RAPID_CLIMB"),
      type: "RAPID_CLIMB",
      severity: "high",
      icao24: flight.icao24,
      timestamp: now,
      value: flight.verticalRate,
    });
  }

  return anomalies;
}
