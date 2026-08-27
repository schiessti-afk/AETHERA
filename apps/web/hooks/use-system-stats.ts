"use client";

import { useEffect, useRef, useState } from "react";
import type { ConnectionStatus, SystemStats } from "@aethera/types";
import { fetchStats } from "@/lib/api";

const empty: SystemStats = {
  observed: 0,
  airborne: 0,
  onGround: 0,
  climbing: 0,
  descending: 0,
  lastUpdate: null,
  sourceTime: null,
  quotaRemaining: null,
  pollIntervalMs: null,
  staleAfterMs: null,
  lastError: null,
};

const DEFAULT_POLL_MS = 90_000;
const POLL_BUFFER_MS = 5_000;

export interface SystemStatsState {
  stats: SystemStats;
  status: ConnectionStatus;
  /** Estimated ms until the next ingestion poll lands, or null if unknown. */
  nextPollEtaMs: number | null;
  /** Force an immediate refetch, outside the normal cadence — for a manual retry action. */
  retry: () => void;
}

function deriveStatus(next: SystemStats): ConnectionStatus {
  if (!next.lastUpdate) return "DEGRADED";

  const staleAfterMs = next.staleAfterMs ?? 300_000;
  const pollMs = next.pollIntervalMs ?? DEFAULT_POLL_MS;
  const age = Date.now() - Date.parse(next.lastUpdate);

  // An explicit upstream error takes priority once the picture is old enough
  // to notice — a single missed poll with a transient error still reads LIVE.
  if (next.lastError && age > pollMs * 1.5) return "DEGRADED";
  if (age >= staleAfterMs) return "STALE";
  if (age < pollMs * 1.5) return "LIVE";
  return "DELAYED";
}

/**
 * `/api/stats` gives the global observed count (the WS feed is viewport-scoped).
 * Cadence tracks the server's own OpenSky poll interval — spec §34.1 explicitly
 * rules out a fixed 5s tick, since that would imply a freshness the data doesn't have.
 */
export function useSystemStats(): SystemStatsState {
  const [stats, setStats] = useState<SystemStats>(empty);
  const [status, setStatus] = useState<ConnectionStatus>("CONNECTING");
  const [nextPollEtaMs, setNextPollEtaMs] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const next = await fetchStats();
        if (cancelled) return;
        setStats(next);
        const pollMs = next.pollIntervalMs ?? DEFAULT_POLL_MS;
        if (next.sourceTime) {
          const elapsed = Date.now() - Date.parse(next.sourceTime);
          setNextPollEtaMs(Math.max(0, pollMs - elapsed));
        } else {
          setNextPollEtaMs(null);
        }

        const statusNow = deriveStatus(next);
        setStatus(statusNow);

        // When delayed, check again soon so LIVE returns as soon as a poll lands
        // rather than waiting a full interval on a stale snapshot.
        const nextDelay =
          statusNow === "DELAYED" || statusNow === "STALE" || statusNow === "DEGRADED"
            ? 15_000
            : pollMs + POLL_BUFFER_MS;
        if (!cancelled) timerRef.current = setTimeout(() => void tick(), nextDelay);
      } catch {
        if (!cancelled) {
          setStatus("OFFLINE");
          setNextPollEtaMs(null);
          timerRef.current = setTimeout(() => void tick(), 10_000);
        }
      }
    }

    tickRef.current = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void tick();
    };

    void tick();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const retry = () => tickRef.current();

  return { stats, status, nextPollEtaMs, retry };
}
