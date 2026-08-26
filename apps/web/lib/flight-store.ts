"use client";

import type { BoundingBox, ConnectionStatus, FlightState } from "@aethera/types";
import { STALE_AFTER_S, REMOVE_AFTER_S } from "@aethera/flight-engine";
import { wsUrl } from "./config";

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
}

type Listener = () => void;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 15000;

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
  };

  private listeners = new Set<Listener>();
  private trails = new Map<string, TrailPoint[]>();

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
    if (icao24 == null) return;
    if (!this.trails.has(icao24)) this.trails.set(icao24, []);
  }

  follow(icao24: string | null): void {
    this.patch({ followed: icao24 });
  }

  hover(icao24: string | null): void {
    this.patch({ hovered: icao24 });
  }

  toggleTrail(): void {
    this.patch({ trailVisible: !this.snapshot.trailVisible });
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
          data: { aircraft: FlightState[]; count: number };
        };
        if (message.type === "flight.updated") {
          this.applySnapshot(message.data.aircraft);
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

    this.patch({
      aircraft: next,
      status: "LIVE",
      sourceTime: latestSourceTime,
      followed:
        this.snapshot.followed && !next.has(this.snapshot.followed)
          ? null
          : this.snapshot.followed,
    });
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

  private patch(partial: Partial<FlightStoreSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const listener of this.listeners) listener();
  }
}

export const flightStore = new FlightStore();
