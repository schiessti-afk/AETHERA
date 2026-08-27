import type {
  AircraftMetadata,
  Airport,
  AirspaceSample,
  Anomaly,
  BoundingBox,
  FlightSession,
  FlightState,
  HistorySummary,
  RegistryEntry,
  SystemStats,
  TrackHourExpanded,
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

export function fetchAircraftDetail(
  icao24: string,
): Promise<(Partial<FlightState> & { metadata: AircraftMetadata | null; observed?: boolean })> {
  return getJson(`/api/aircraft/${encodeURIComponent(icao24)}`);
}

export function fetchRegistry(): Promise<{
  index: Record<string, RegistryEntry>;
  count: number;
}> {
  return getJson("/api/registry");
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
  aircraft: Array<FlightState & { registration?: string | null; typeCode?: string | null }>;
  airports: Array<{ icao: string; iata?: string; name: string }>;
}> {
  return getJson(`/api/search?q=${encodeURIComponent(q)}`);
}

// --- History ----------------------------------------------------------------

function historyBoundsQuery(bounds: BoundingBox): string {
  return `west=${bounds.west}&south=${bounds.south}&east=${bounds.east}&north=${bounds.north}`;
}

export function fetchHistorySummary(
  from: string,
  to: string,
  bounds: BoundingBox,
): Promise<HistorySummary> {
  return getJson(
    `/api/history/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&${historyBoundsQuery(bounds)}`,
  );
}

export interface HistoryRegionPage {
  from: string;
  to: string;
  bounds: BoundingBox;
  hours: TrackHourExpanded[];
  count: number;
  nextCursor: string | null;
}

export function fetchHistoryRegion(params: {
  from: string;
  to: string;
  bounds: BoundingBox;
  cursor?: string | null;
  limit?: number;
}): Promise<HistoryRegionPage> {
  const query = new URLSearchParams({
    from: params.from,
    to: params.to,
    west: String(params.bounds.west),
    south: String(params.bounds.south),
    east: String(params.bounds.east),
    north: String(params.bounds.north),
  });
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  return getJson(`/api/history/region?${query}`);
}

export async function fetchAllHistoryHours(params: {
  from: string;
  to: string;
  bounds: BoundingBox;
  onPage?: (loadedHours: number) => void;
}): Promise<TrackHourExpanded[]> {
  const hours: TrackHourExpanded[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page = await fetchHistoryRegion({ ...params, cursor });
    hours.push(...page.hours);
    cursor = page.nextCursor;
    pages += 1;
    params.onPage?.(hours.length);
  } while (cursor && pages < 50);
  return hours;
}

export function fetchHistorySessions(params: {
  from: string;
  to: string;
  bounds?: BoundingBox;
  icao24?: string;
}): Promise<{ sessions: FlightSession[]; count: number }> {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  if (params.icao24) query.set("icao24", params.icao24);
  if (params.bounds) {
    query.set("west", String(params.bounds.west));
    query.set("south", String(params.bounds.south));
    query.set("east", String(params.bounds.east));
    query.set("north", String(params.bounds.north));
  }
  return getJson(`/api/history/sessions?${query}`);
}
