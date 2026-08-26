import type {
  AircraftMetadata,
  Anomaly,
  FlightState,
  SystemStats,
} from "@aethera/types";
import { apiUrl } from "./config";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`API ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchStats(): Promise<SystemStats> {
  return getJson<SystemStats>("/api/stats");
}

export function fetchAircraft(): Promise<{ aircraft: FlightState[]; count: number }> {
  return getJson("/api/aircraft");
}

/** Observed state plus whatever registry metadata exists for the airframe. */
export function fetchAircraftDetail(
  icao24: string,
): Promise<FlightState & { metadata: AircraftMetadata | null }> {
  return getJson(`/api/aircraft/${encodeURIComponent(icao24)}`);
}

export interface TrailPointDto {
  longitude: number;
  latitude: number;
  altitude: number | null;
  timestamp: number;
}

/** Positions AETHERA observed and recorded — not a provider track query. */
export function fetchTrail(
  icao24: string,
): Promise<{ icao24: string; points: TrailPointDto[]; count: number }> {
  return getJson(`/api/aircraft/${encodeURIComponent(icao24)}/trail`);
}

export interface AnomalyFeed {
  anomalies: Anomaly[];
  /** Count of currently-open detections, before any filter is applied. */
  active: number;
  /** Everything inside the retention window, before any filter is applied. */
  total: number;
}

export function fetchAnomalies(params?: {
  severity?: string[];
  type?: string[];
}): Promise<AnomalyFeed> {
  const query = new URLSearchParams();
  if (params?.severity?.length) query.set("severity", params.severity.join(","));
  if (params?.type?.length) query.set("type", params.type.join(","));
  const suffix = query.toString() ? `?${query}` : "";
  return getJson<AnomalyFeed>(`/api/anomalies${suffix}`);
}

export function search(q: string): Promise<{
  aircraft: FlightState[];
  airports: Array<{ icao: string; iata?: string; name: string }>;
}> {
  return getJson(`/api/search?q=${encodeURIComponent(q)}`);
}
