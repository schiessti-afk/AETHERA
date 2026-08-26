import type {
  AircraftMetadata,
  Airport,
  AirspaceSample,
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

// --- Airports ---------------------------------------------------------------

export type TrafficRelation =
  | "on_ground"
  | "descending"
  | "climbing"
  | "level"
  | "overflight";

export interface AirportTrafficEntry {
  icao24: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  relation: TrafficRelation;
  distanceKm: number;
  lastSeen: string;
}

export interface AirportTraffic {
  airport: Airport;
  radiusKm: number;
  counts: Record<TrafficRelation, number>;
  total: number;
  traffic: AirportTrafficEntry[];
}

export function fetchAirports(params?: {
  q?: string;
  bbox?: string;
  limit?: number;
}): Promise<{ airports: Airport[] }> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  if (params?.bbox) query.set("bbox", params.bbox);
  if (params?.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query}` : "";
  return getJson(`/api/airports${suffix}`);
}

export function fetchAirportTraffic(
  icao: string,
  radiusKm?: number,
): Promise<AirportTraffic> {
  const suffix = radiusKm ? `?radius=${radiusKm}` : "";
  return getJson(`/api/airports/${encodeURIComponent(icao)}/traffic${suffix}`);
}

// --- Analytics --------------------------------------------------------------

export function fetchAnalyticsSummary(
  bbox?: string,
): Promise<{ scope: "global" | "region"; summary: AirspaceSample }> {
  return getJson(`/api/analytics/summary${bbox ? `?bbox=${bbox}` : ""}`);
}

export function fetchAnalyticsHistory(
  hours: number,
): Promise<{ hours: number; samples: AirspaceSample[]; count: number }> {
  return getJson(`/api/analytics/history?hours=${hours}`);
}

export function fetchDensity(
  bbox?: string,
): Promise<{ points: Array<[number, number]>; count: number }> {
  return getJson(`/api/analytics/density${bbox ? `?bbox=${bbox}` : ""}`);
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
