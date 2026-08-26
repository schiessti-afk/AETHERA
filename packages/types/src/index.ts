export type Icao24 = string;

export type ConnectionStatus =
  | "LIVE"
  | "CONNECTING"
  | "DELAYED"
  | "DEGRADED"
  | "STALE"
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

/**
 * Registry metadata, kept deliberately separate from FlightState: this is reference
 * data about an airframe, not something observed from its transponder. It may be
 * missing or out of date without affecting any live telemetry (PRODUCT_SPEC §24.4).
 */
export interface AircraftMetadata {
  registration: string | null;
  typeCode: string | null;
  operator: string | null;
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
  | "LOST_SIGNAL"
  // Catalogued in PRODUCT_SPEC §26.2 as later detections, and deliberately not
  // detected today: measured against live traffic, 6.6% of airborne aircraft change
  // heading by >90° between two consecutive 90s polls. At this cadence a "sudden
  // change" detector measures the poll interval, not the aircraft.
  | "SUDDEN_HEADING_CHANGE"
  | "SUDDEN_ALTITUDE_CHANGE";

export type AnomalySeverity = "info" | "medium" | "high" | "critical";

/**
 * Whether a detection is a condition that stays true over time, or a single
 * observation. At a ~90s poll, extreme vertical rates almost never persist to the
 * next snapshot (measured: 8-13%), so they have no meaningful "active" period —
 * they are recorded once and retained for the feed rather than held open.
 */
export type AnomalyKind = "state" | "event";

export interface Anomaly {
  id: string;
  type: AnomalyType;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  icao24: Icao24;
  callsign?: string;
  /** Telemetry captured at detection time — PRODUCT_SPEC §18.2. */
  latitude?: number;
  longitude?: number;
  altitude?: number;
  /** The observed value that triggered detection: squawk code, or vertical rate in m/s. */
  value: string | number;
  detectedAt: string;
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
  sourceTime: string | null;
  creditsRemaining: number | null;
  pollIntervalMs: number | null;
  staleAfterMs: number | null;
  lastError: string | null;
}

export interface FlightDataProvider {
  getStates(bounds?: BoundingBox): Promise<FlightState[]>;
}
