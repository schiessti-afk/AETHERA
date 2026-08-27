"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { BoundingBox } from "@aethera/types";
import { HistoryMap } from "@/components/history-map";
import { ReplayControls } from "@/components/replay-controls";
import { replayStore } from "@/lib/replay-store";
import { useReplayStore } from "@/hooks/use-replay-store";
import { fetchAllHistoryHours, fetchHistorySessions, fetchHistorySummary } from "@/lib/api";
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/map-style";

const MAX_WINDOW_MS = 6 * 60 * 60_000;
const DEFAULT_WINDOW_MS = 60 * 60_000;

export function HistoryView() {
  const boundsRef = useRef<BoundingBox | null>(null);
  const [fromLocal, setFromLocal] = useState(() =>
    toDatetimeLocalValue(Date.now() - DEFAULT_WINDOW_MS),
  );
  const [toLocal, setToLocal] = useState(() => toDatetimeLocalValue(Date.now()));
  const [loadNote, setLoadNote] = useState<string | null>(null);
  const { loaded, loading, empty, error } = useReplayStore();

  useEffect(() => {
    return () => replayStore.clear();
  }, []);

  const onBounds = useCallback((bounds: BoundingBox) => {
    boundsRef.current = bounds;
  }, []);

  async function load() {
    const bounds = boundsRef.current;
    if (!bounds) {
      replayStore.fail("Pan the map to a region, then load history.");
      return;
    }

    let from = fromDatetimeLocalValue(fromLocal);
    let to = fromDatetimeLocalValue(toLocal);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      replayStore.fail("Choose a valid time range.");
      return;
    }
    if (to - from > MAX_WINDOW_MS) {
      from = to - MAX_WINDOW_MS;
      setFromLocal(toDatetimeLocalValue(from));
      setLoadNote("Window capped at 6 hours.");
    } else {
      setLoadNote(null);
    }

    const fromIso = new Date(from).toISOString();
    const toIso = new Date(to).toISOString();

    replayStore.beginLoading();
    try {
      const summary = await fetchHistorySummary(fromIso, toIso, bounds);
      if (summary.pointCount === 0) {
        replayStore.loadEmpty(from, to);
        return;
      }

      const hours = await fetchAllHistoryHours({ from: fromIso, to: toIso, bounds });
      const { sessions } = await fetchHistorySessions({ from: fromIso, to: toIso, bounds });
      replayStore.load(hours, sessions, from, to);
    } catch (err) {
      replayStore.fail(err instanceof Error ? err.message : "History request failed");
    }
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      <HistoryMap onBounds={onBounds} />

      <div className="absolute left-3 top-14 z-[var(--z-panels)] w-[min(320px,calc(100vw-1.5rem))] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-panel)]">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            History
          </h2>
          <Link
            href="/"
            className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)] hover:underline"
          >
            Return to live
          </Link>
        </div>
        <p className="mb-3 text-[11px] text-[var(--color-text-subtle)]">
          Pick a time range, then replay the current map region.
        </p>
        <label className="mb-2 block text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
          From
          <input
            type="datetime-local"
            value={fromLocal}
            onChange={(e) => setFromLocal(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-[12px] text-[var(--color-text)]"
          />
        </label>
        <label className="mb-3 block text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
          To
          <input
            type="datetime-local"
            value={toLocal}
            onChange={(e) => setToLocal(e.target.value)}
            className="mt-1 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-[12px] text-[var(--color-text)]"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-interactive)] py-1.5 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text)] hover:bg-[var(--color-surface-selected)] disabled:opacity-40"
        >
          {loading ? "Loading…" : "Load this view"}
        </button>
        {loadNote ? (
          <p className="mt-2 text-[10px] text-[var(--color-text-subtle)]">{loadNote}</p>
        ) : null}
        {error ? (
          <p className="mt-2 text-[11px] text-[var(--color-alert)]">{error}</p>
        ) : null}
      </div>

      {loaded && empty ? (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[var(--z-panels)] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-center shadow-[var(--shadow-panel)]">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            No history yet
          </div>
          <p className="mt-2 text-[13px] text-[var(--color-text)]">
            History begins the day AETHERA starts recording. There is no backfill of earlier
            flights — an empty replay is not a failure.
          </p>
        </div>
      ) : null}

      {loaded && !empty ? (
        <div className="absolute bottom-3 left-1/2 z-[var(--z-panels)] -translate-x-1/2">
          <ReplayControls />
        </div>
      ) : null}
    </div>
  );
}
