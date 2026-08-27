"use client";

import type { FlightSession, FlightState, TrackHourExpanded } from "@aethera/types";
import { interpolateTrack, type TrackSample } from "@aethera/flight-engine";
import { replayModeStore } from "./replay-mode";

export interface ReplayTrailPoint {
  latitude: number;
  longitude: number;
  timestamp: number;
}

export interface ReplaySnapshot {
  loaded: boolean;
  loading: boolean;
  empty: boolean;
  error: string | null;
  from: number;
  to: number;
  cursor: number;
  playing: boolean;
  speed: number;
  selected: string | null;
  hovered: string | null;
  followed: string | null;
  trailVisible: boolean;
  observed: number;
  interpolatedSelected: boolean;
}

type Listener = () => void;

const SPEEDS = [1, 2, 4, 8, 16, 32] as const;
export type ReplaySpeed = (typeof SPEEDS)[number];

interface Track {
  icao24: string;
  points: TrackSample[];
}

function callsignAt(sessions: FlightSession[], icao24: string, at: number): string | undefined {
  for (const session of sessions) {
    if (session.icao24 !== icao24) continue;
    const start = Date.parse(session.startedAt);
    const end = session.endedAt ? Date.parse(session.endedAt) : Number.POSITIVE_INFINITY;
    if (at >= start && at <= end) return session.callsign ?? undefined;
  }
  return undefined;
}

function hoursToTracks(hours: TrackHourExpanded[]): Map<string, Track> {
  const tracks = new Map<string, Track>();
  for (const hour of hours) {
    let track = tracks.get(hour.icao24);
    if (!track) {
      track = { icao24: hour.icao24, points: [] };
      tracks.set(hour.icao24, track);
    }
    for (const point of hour.points) {
      track.points.push({
        time: Date.parse(point.time),
        latitude: point.latitude,
        longitude: point.longitude,
        altitude: point.altitude,
      });
    }
  }
  for (const track of tracks.values()) {
    track.points.sort((a, b) => a.time - b.time);
  }
  return tracks;
}

/**
 * Historical playback. Same aircraft language as live Explore, driven by stored
 * observations rather than the WebSocket snapshot.
 */
export class ReplayStore {
  private tracks = new Map<string, Track>();
  private sessions: FlightSession[] = [];
  private listeners = new Set<Listener>();
  private lastModeEmit = 0;
  private snapshot: ReplaySnapshot = {
    loaded: false,
    loading: false,
    empty: false,
    error: null,
    from: 0,
    to: 0,
    cursor: 0,
    playing: false,
    speed: 16,
    selected: null,
    hovered: null,
    followed: null,
    trailVisible: true,
    observed: 0,
    interpolatedSelected: false,
  };

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ReplaySnapshot => this.snapshot;

  beginLoading(): void {
    this.patch({ loading: true, error: null, empty: false, loaded: false, playing: false });
  }

  fail(message: string): void {
    this.patch({ loading: false, error: message, loaded: false, playing: false });
  }

  loadEmpty(from: number, to: number): void {
    this.tracks = new Map();
    this.sessions = [];
    this.patch({
      loading: false,
      loaded: true,
      empty: true,
      error: null,
      from,
      to,
      cursor: from,
      playing: false,
      observed: 0,
      selected: null,
      followed: null,
    });
    replayModeStore.set({
      active: true,
      timestamp: new Date(from).toISOString(),
      observed: 0,
      airborne: 0,
    });
  }

  load(
    hours: TrackHourExpanded[],
    sessions: FlightSession[],
    from: number,
    to: number,
  ): void {
    this.tracks = hoursToTracks(hours);
    this.sessions = sessions;
    const empty = this.tracks.size === 0;
    this.patch({
      loading: false,
      loaded: true,
      empty,
      error: null,
      from,
      to,
      cursor: from,
      playing: false,
      observed: 0,
      selected: null,
      followed: null,
    });
    this.tickTo(from);
  }

  clear(): void {
    this.tracks = new Map();
    this.sessions = [];
    this.snapshot = {
      loaded: false,
      loading: false,
      empty: false,
      error: null,
      from: 0,
      to: 0,
      cursor: 0,
      playing: false,
      speed: 16,
      selected: null,
      hovered: null,
      followed: null,
      trailVisible: true,
      observed: 0,
      interpolatedSelected: false,
    };
    this.notify();
    replayModeStore.clear();
  }

  play(): void {
    if (!this.snapshot.loaded || this.snapshot.empty) return;
    if (this.snapshot.cursor >= this.snapshot.to) this.patch({ cursor: this.snapshot.from });
    this.patch({ playing: true });
  }

  pause(): void {
    this.patch({ playing: false });
  }

  togglePlay(): void {
    if (this.snapshot.playing) this.pause();
    else this.play();
  }

  setSpeed(speed: number): void {
    this.patch({ speed });
  }

  cycleSpeed(): void {
    const index = SPEEDS.indexOf(this.snapshot.speed as ReplaySpeed);
    const next = SPEEDS[(index + 1) % SPEEDS.length];
    this.patch({ speed: next });
  }

  scrub(cursor: number): void {
    const clamped = Math.min(this.snapshot.to, Math.max(this.snapshot.from, cursor));
    this.patch({ playing: false });
    this.tickTo(clamped);
  }

  advance(deltaMs: number): void {
    if (!this.snapshot.playing) return;
    const next = this.snapshot.cursor + deltaMs * this.snapshot.speed;
    if (next >= this.snapshot.to) {
      this.tickTo(this.snapshot.to, true);
      this.patch({ playing: false });
      return;
    }
    // Cursor moves every animation frame. Do not notify React — the map reads
    // the store imperatively, matching live Explore's interpolation loop.
    this.tickTo(next, false);
  }

  select(icao24: string | null): void {
    this.patch({ selected: icao24 });
  }

  hover(icao24: string | null): void {
    this.patch({ hovered: icao24 });
  }

  follow(icao24: string | null): void {
    this.patch({ followed: icao24 });
  }

  toggleTrail(): void {
    this.patch({ trailVisible: !this.snapshot.trailVisible });
  }

  getTrail(icao24: string): ReplayTrailPoint[] {
    const track = this.tracks.get(icao24);
    if (!track) return [];
    return track.points
      .filter((p) => p.time <= this.snapshot.cursor)
      .map((p) => ({ latitude: p.latitude, longitude: p.longitude, timestamp: p.time }));
  }

  statesAt(at = this.snapshot.cursor): FlightState[] {
    const states: FlightState[] = [];
    const isoAt = new Date(at).toISOString();
    for (const track of this.tracks.values()) {
      const pos = interpolateTrack(track.points, at);
      if (!pos) continue;
      const lastSeen = new Date(pos.lastSeen).toISOString();
      states.push({
        icao24: track.icao24,
        callsign: callsignAt(this.sessions, track.icao24, at),
        latitude: pos.latitude,
        longitude: pos.longitude,
        altitude: pos.altitude ?? undefined,
        heading: pos.heading,
        velocity: pos.velocity,
        onGround: pos.altitude != null && pos.altitude < 15,
        lastSeen,
        receivedAt: isoAt,
        processedAt: isoAt,
      });
    }
    return states;
  }

  interpolatedAt(icao24: string, at = this.snapshot.cursor): boolean {
    const track = this.tracks.get(icao24);
    if (!track) return false;
    return interpolateTrack(track.points, at)?.interpolated ?? false;
  }

  private tickTo(cursor: number, notify = true): void {
    const states = this.statesAt(cursor);
    const airborne = states.filter((s) => !s.onGround).length;
    const interpolatedSelected = this.snapshot.selected
      ? this.interpolatedAt(this.snapshot.selected, cursor)
      : false;
    this.snapshot = {
      ...this.snapshot,
      cursor,
      observed: states.length,
      interpolatedSelected,
    };
    if (notify) this.notify();

    const now = Date.now();
    if (notify || now - this.lastModeEmit > 1000) {
      this.lastModeEmit = now;
      replayModeStore.set({
        active: true,
        timestamp: new Date(cursor).toISOString(),
        observed: states.length,
        airborne,
      });
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private patch(partial: Partial<ReplaySnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    this.notify();
  }
}

export const replayStore = new ReplayStore();
export const REPLAY_SPEEDS: readonly number[] = SPEEDS;
