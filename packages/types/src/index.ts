export type Icao24 = string;

export type ConnectionStatus =
  | "LIVE"
  | "CONNECTING"
  | "DELAYED"
  | "DEGRADED"
  | "OFFLINE";

export interface BoundingBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Normalized aircraft state. Provider formats never leak past ingestion. */
export interface FlightState {
  icao24: Icao24;
  callsign?: string;
  originCountry?: string;
  latitude: number;
  longitude: number;
  /** Barometric altitude in meters. */
  altitude?: number;
  /** Geometric altitude in meters. */
  geoAltitude?: number;
  /** Ground speed in meters per second. */
  velocity?: number;
  /** True track in degrees. */
  heading?: number;
  /** Vertical rate in meters per second. */
  verticalRate?: number;
  squawk?: string;
  onGround: boolean;
  spi?: boolean;
  /** Observation time from the data source (ISO-8601). */
  lastSeen: string;
  /** Time AETHERA received the state (ISO-8601). */
  receivedAt: string;
  /** Time AETHERA finished normalizing the state (ISO-8601). */
  processedAt: string;
}

export interface AircraftQuery {
  west?: number;
  south?: number;
  east?: number;
  north?: number;
  altitudeMin?: number;
  altitudeMax?: number;
  onGround?: boolean;
  callsign?: string;
  squawk?: string;
}

export interface Airport {
  icao: string;
  iata?: string;
  name: string;
  city?: string;
  country?: string;
  latitude: number;
  longitude: number;
  elevation?: number;
}

export type AnomalyType =
  | "EMERGENCY_SQUAWK"
  | "RAPID_DESCENT"
  | "RAPID_CLIMB"
  | "SUDDEN_HEADING_CHANGE"
  | "SUDDEN_ALTITUDE_CHANGE"
  | "LOST_SIGNAL";

export type AnomalySeverity = "info" | "medium" | "high" | "critical";

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  icao24: Icao24;
  timestamp: string;
  value: string | number;
  resolvedAt?: string;
}

export type RealtimeEventType =
  | "flight.created"
  | "flight.updated"
  | "flight.removed"
  | "anomaly.detected"
  | "anomaly.resolved"
  | "aircraft.updated";

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType | string;
  timestamp: string;
  data: T;
}

export interface ViewportSubscribeMessage {
  type: "viewport.subscribe";
  bounds: BoundingBox;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  services: Record<string, "healthy" | "degraded" | "unhealthy">;
  dataAgeSeconds?: number;
}

export interface SystemStats {
  observed: number;
  airborne: number;
  onGround: number;
  lastUpdate: string | null;
}

export interface FlightDataProvider {
  getStates(bounds?: BoundingBox): Promise<FlightState[]>;
}
