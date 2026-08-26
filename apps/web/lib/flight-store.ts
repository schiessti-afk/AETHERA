"use client";

import type {
  Anomaly,
  AnomalySeverity,
  BoundingBox,
  ConnectionStatus,
  FlightState,
} from "@aethera/types";
import { STALE_AFTER_S, REMOVE_AFTER_S } from "@aethera/flight-engine";
import { wsUrl } from "./config";
import { fetchTrail } from "./api";

const TRAIL_MAX_POINTS = 120;
/** Only the selected/followed aircraft gets a trail — spec §14.3. */
export interface TrailPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface FlightStoreSnapshot {
  aircraft: Map<string, FlightState>;
  status: ConnectionStatus;
  selected: string | null;
  followed: string | null;
  hovered: string | null;
  sourceTime: string | null;
  trailVisible: boolean;
  /** Set when a followed aircraft stopped being observed, so the UI can say so. */
  followLost: { icao24: string; at: number } | null;
  /**
   * icao24 -> highest severity currently open against it. Drives the ALERT marker
   * state on the map; the full feed lives on the Alerts surface, not in this store.
   */
  alerted: Map<string, AnomalySeverity>;
}

type Listener = () => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

/** Lower is more severe, so the strongest open condition wins the marker. */
const SEVERITY_RANK: Record<AnomalySeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  info: 3,
};

/**
 * Owns the WebSocket connection, the live aircraft map, and selection/follow
 * UI state. Deliberately outside React's render loop: interpolation runs on
 * requestAnimationFrame and feeds deck.gl directly (see map-viewport.tsx),
 * while this store only notifies React on discrete changes (new snapshot,
 * connection status, selection).
 */
export class FlightStore {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;
  private bounds: BoundingBox | null = null;

  private snapshot: FlightStoreSnapshot = {
    aircraft: new Map(),
    status: "CONNECTING",
    selected: null,
    followed: null,
    hovered: null,
    sourceTime: null,
    trailVisible: true,
    alerted: new Map(),
    followLost: null,
  };

  private listeners = new Set<Listener>();
  private trails = new Map<string, TrailPoint[]>();
  private pendingFlyTo: { longitude: number; latitude: number } | null = null;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): FlightStoreSnapshot => this.snapshot;

  connect(): void {
    if (typeof window === "undefined") return;
    this.closedByUser = false;
    this.open();
  }

  disconnect(): void {
    this.closedByUser = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  setBounds(bounds: BoundingBox): void {
    this.bounds = bounds;
    this.send({ type: "viewport.subscribe", bounds });
  }

  select(icao24: string | null): void {
    this.patch({ selected: icao24 });
    this.declareWatch();
    if (icao24 == null) return;
    if (!this.trails.has(icao24)) this.trails.set(icao24, []);
    void this.loadStoredTrail(icao24);
  }

  /**
   * Seeds the trail from positions AETHERA already recorded, so selecting an aircraft
   * shows where it has been rather than starting an empty line from this moment. Live
   * points continue to append on top.
   */
  private async loadStoredTrail(icao24: string): Promise<void> {
    try {
      const { points } = await fetchTrail(icao24);
      if (points.length === 0) return;
      // Discard if the user moved on while the request was in flight.
      if (this.snapshot.selected !== icao24 && this.snapshot.followed !== icao24) return;

      const existing = this.trails.get(icao24) ?? [];
      const seenAt = new Set(existing.map((p) => p.timestamp));
      const merged = [
        ...points
          .filter((p) => !seenAt.has(p.timestamp))
          .map((p) => ({
            latitude: p.latitude,
            longitude: p.longitude,
            timestamp: p.timestamp,
          })),
        ...existing,
      ].sort((a, b) => a.timestamp - b.timestamp);

      this.trails.set(icao24, merged.slice(-TRAIL_MAX_POINTS));
      this.notify();
    } catch {
      // A missing trail is not an error worth surfacing; the live one still builds.
    }
  }

  follow(icao24: string | null): void {
    this.patch({ followed: icao24, followLost: null });
    this.declareWatch();
  }

  /**
   * Tells the server which aircraft this client is on, which is what scopes
   * LOST_SIGNAL detection. Re-sent on every snapshot so the server-side watch keeps
   * refreshing for as long as the aircraft stays selected.
   */
  private declareWatch(): void {
    const icao24 = this.snapshot.followed ?? this.snapshot.selected;
    this.send({ type: "aircraft.watch", icao24 });
  }

  hover(icao24: string | null): void {
    this.patch({ hovered: icao24 });
  }

  toggleTrail(): void {
    this.patch({ trailVisible: !this.snapshot.trailVisible });
  }

  /**
   * Parks a camera target for the map to pick up. Alerts live on their own route, so
   * the map may not be mounted at the moment the user clicks one — it claims the
   * request on mount instead.
   */
  requestFlyTo(longitude: number, latitude: number): void {
    this.pendingFlyTo = { longitude, latitude };
  }

  /** Returns and clears any parked camera target. */
  claimFlyTo(): { longitude: number; latitude: number } | null {
    const pending = this.pendingFlyTo;
    this.pendingFlyTo = null;
    return pending;
  }

  getTrail(icao24: string): TrailPoint[] {
    return this.trails.get(icao24) ?? [];
  }

  private open(): void {
    const socket = new WebSocket(wsUrl);
    this.ws = socket;
    this.patch({ status: this.snapshot.status === "LIVE" ? "DELAYED" : "CONNECTING" });

    socket.onopen = () => {
      this.reconnectAttempt = 0;
      if (this.bounds) this.send({ type: "viewport.subscribe", bounds: this.bounds });
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as {
          type: string;
          timestamp: string;
          data: unknown;
        };

        if (message.type === "flight.updated") {
          const data = message.data as { aircraft: FlightState[]; count: number };
          this.applySnapshot(data.aircraft);
          this.declareWatch(); // refresh the server-side watch each cycle
          return;
        }

        if (message.type === "anomaly.detected") {
          this.applyAnomaly(message.data as Anomaly, true);
          return;
        }

        if (message.type === "anomaly.resolved") {
          this.applyAnomaly(message.data as Anomaly, false);
        }
      } catch {
        // ignore malformed server messages
      }
    };

    socket.onclose = () => {
      if (this.ws !== socket) return; // superseded by a newer socket
      this.ws = null;
      this.patch({ status: "OFFLINE" });
      if (!this.closedByUser) this.scheduleReconnect();
    };

    socket.onerror = () => {
      socket.close();
    };
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempt,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      if (!this.closedByUser) this.open();
    }, delay);
  }

  private send(payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  /**
   * Maintains only the map-highlighting view of anomalies: which aircraft currently
   * have something open against them, at what severity. The Alerts surface fetches the
   * full feed from the API rather than reconstructing it from a stream it may have
   * joined halfway through.
   */
  private applyAnomaly(anomaly: Anomaly, opened: boolean): void {
    if (anomaly.kind !== "state") return; // events are feed items, not durable map state

    const alerted = new Map(this.snapshot.alerted);
    if (opened) {
      const current = alerted.get(anomaly.icao24);
      if (!current || SEVERITY_RANK[anomaly.severity] < SEVERITY_RANK[current]) {
        alerted.set(anomaly.icao24, anomaly.severity);
      }
    } else {
      alerted.delete(anomaly.icao24);
    }
    this.patch({ alerted });
  }

  /** Replaces map highlighting wholesale from an authoritative feed read. */
  seedAlerts(anomalies: Anomaly[]): void {
    const alerted = new Map<string, AnomalySeverity>();
    for (const anomaly of anomalies) {
      if (anomaly.resolvedAt || anomaly.kind !== "state") continue;
      const current = alerted.get(anomaly.icao24);
      if (!current || SEVERITY_RANK[anomaly.severity] < SEVERITY_RANK[current]) {
        alerted.set(anomaly.icao24, anomaly.severity);
      }
    }
    this.patch({ alerted });
  }

  private applySnapshot(states: FlightState[]): void {
    const next = new Map<string, FlightState>();
    let latestSourceTime = this.snapshot.sourceTime;
    for (const state of states) {
      next.set(state.icao24, state);
      if (!latestSourceTime || state.receivedAt > latestSourceTime) {
        latestSourceTime = state.receivedAt;
      }
    }

    this.pruneRemoved(next);
    this.recordTrailPoints(next);

    // Losing the followed aircraft exits follow and says so, rather than silently
    // dropping it or leaving the camera tracking a ghost (§13).
    const followLost = Boolean(
      this.snapshot.followed && !next.has(this.snapshot.followed),
    );

    this.patch({
      aircraft: next,
      status: "LIVE",
      sourceTime: latestSourceTime,
      followed: followLost ? null : this.snapshot.followed,
      followLost: followLost
        ? { icao24: this.snapshot.followed!, at: Date.now() }
        : this.snapshot.followLost,
    });
  }

  /** Dismisses the contact-lost notice. */
  clearFollowLost(): void {
    this.patch({ followLost: null });
  }

  /** Evict aircraft that have been gone longer than the removal grace period. */
  private pruneRemoved(next: Map<string, FlightState>): void {
    const now = Date.now();
    for (const [icao24, flight] of next) {
      const ageS = (now - Date.parse(flight.lastSeen)) / 1000;
      if (ageS > REMOVE_AFTER_S) {
        next.delete(icao24);
        this.trails.delete(icao24);
      }
    }
    void STALE_AFTER_S; // freshness thresholds consumed by the renderer, not here
  }

  private recordTrailPoints(next: Map<string, FlightState>): void {
    const tracked = new Set(
      [this.snapshot.selected, this.snapshot.followed].filter(
        (id): id is string => id != null,
      ),
    );
    for (const icao24 of tracked) {
      const flight = next.get(icao24);
      if (!flight) continue;
      const trail = this.trails.get(icao24) ?? [];
      const last = trail[trail.length - 1];
      if (!last || last.latitude !== flight.latitude || last.longitude !== flight.longitude) {
        trail.push({
          latitude: flight.latitude,
          longitude: flight.longitude,
          timestamp: Date.parse(flight.lastSeen),
        });
      }
      if (trail.length > TRAIL_MAX_POINTS) trail.splice(0, trail.length - TRAIL_MAX_POINTS);
      this.trails.set(icao24, trail);
    }
  }

  /**
   * Signals subscribers without changing the snapshot. Trails live outside the snapshot
   * (they are read imperatively by the render loop), so seeding one still needs to wake
   * anything rendering from it.
   */
  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private patch(partial: Partial<FlightStoreSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const listener of this.listeners) listener();
  }
}

export const flightStore = new FlightStore();
