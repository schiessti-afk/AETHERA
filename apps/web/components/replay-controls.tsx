"use client";

import { useEffect, useRef } from "react";
import { Pause, Play } from "lucide-react";
import { replayStore, REPLAY_SPEEDS } from "@/lib/replay-store";
import { useReplayStore } from "@/hooks/use-replay-store";
import { formatReplayTimestamp } from "@/lib/map-style";

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function ReplayControls() {
  const { loaded, empty, playing, speed, from, to } = useReplayStore();
  const sliderRef = useRef<HTMLInputElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const stampRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!loaded || empty) return;
    let raf = 0;
    const tick = () => {
      const snap = replayStore.getSnapshot();
      if (snap.to > snap.from && sliderRef.current) {
        sliderRef.current.value = String(
          Math.round(((snap.cursor - snap.from) / (snap.to - snap.from)) * 1000),
        );
      }
      if (clockRef.current) clockRef.current.textContent = formatClock(snap.cursor - snap.from);
      if (stampRef.current) stampRef.current.textContent = formatReplayTimestamp(snap.cursor);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [loaded, empty, from, to]);

  if (!loaded || empty || to <= from) return null;

  return (
    <div className="pointer-events-auto flex w-[min(720px,calc(100vw-1.5rem))] items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-panel)]">
      <button
        type="button"
        onClick={() => replayStore.togglePlay()}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text)] hover:bg-[var(--color-surface-interactive)]"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>

      <button
        type="button"
        onClick={() => replayStore.cycleSpeed()}
        className="w-12 text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)]"
        aria-label="Playback speed"
      >
        {speed}×
      </button>
      <span className="sr-only">Speeds: {REPLAY_SPEEDS.join("×, ")}×</span>

      <input
        ref={sliderRef}
        type="range"
        min={0}
        max={1000}
        defaultValue={0}
        onChange={(e) => {
          const t = from + (Number(e.target.value) / 1000) * (to - from);
          replayStore.scrub(t);
        }}
        className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--color-surface-elevated)] accent-[var(--color-accent)]"
        aria-label="Scrub replay"
      />

      <span
        ref={clockRef}
        className="w-[4.5rem] text-right tabular-nums text-[11px] text-[var(--color-text-muted)]"
      >
        0:00
      </span>
      <span
        ref={stampRef}
        className="hidden tabular-nums text-[11px] text-[var(--color-text-subtle)] sm:inline"
      />
    </div>
  );
}
