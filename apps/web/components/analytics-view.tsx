"use client";

import { useEffect, useMemo, useState } from "react";
import type { AirspaceSample, BandHistogram } from "@aethera/types";
import { fetchAnalyticsHistory, fetchAnalyticsSummary } from "@/lib/api";

const REFRESH_MS = 30_000;
const HISTORY_OPTIONS = [1, 6, 12, 24];

const ACCENT = "var(--color-accent)";

function formatBandLabel(lower: string, bounds: number[], unit: string): string {
  const value = Number(lower);
  const index = bounds.indexOf(value);
  const upper = bounds[index + 1];
  const k = (n: number) => (n >= 1000 ? `${n / 1000}k` : String(n));
  return upper == null ? `${k(value)}+ ${unit}` : `${k(value)}–${k(upper)}`;
}

/**
 * Horizontal bars. Chosen over a vertical histogram because the band labels are the
 * thing being compared and they read left-to-right without rotation — Design §38 asks
 * charts to emphasise pattern over decoration.
 */
function BandChart({
  title,
  histogram,
  bounds,
  unit,
  note,
}: {
  title: string;
  histogram: BandHistogram;
  bounds: number[];
  unit: string;
  note?: string;
}) {
  const entries = bounds.map((bound) => ({
    key: String(bound),
    label: formatBandLabel(String(bound), bounds, unit),
    value: histogram[String(bound)] ?? 0,
  }));
  const max = Math.max(1, ...entries.map((e) => e.value));
  const total = entries.reduce((sum, e) => sum + e.value, 0);

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          {title}
        </h3>
        <span className="tabular-nums text-[11px] text-[var(--color-text-subtle)]">
          {total.toLocaleString()} observed
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {entries.map((entry) => (
          <div key={entry.key} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-right tabular-nums text-[11px] text-[var(--color-text-subtle)]">
              {entry.label}
            </span>
            <div className="h-3 min-w-0 flex-1 rounded-[2px] bg-[var(--color-surface-elevated)]">
              <div
                className="h-full rounded-[2px] transition-[width] duration-[var(--motion-default)]"
                style={{
                  width: `${(entry.value / max) * 100}%`,
                  background: ACCENT,
                  opacity: 0.75,
                }}
              />
            </div>
            <span className="w-12 shrink-0 tabular-nums text-[11px] text-[var(--color-text)]">
              {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      {note ? (
        <p className="mt-3 text-[10px] text-[var(--color-text-subtle)]">{note}</p>
      ) : null}
    </section>
  );
}

/** Observed count over time, drawn as a plain area so the shape reads at a glance. */
function HistoryChart({ samples }: { samples: AirspaceSample[] }) {
  const path = useMemo(() => {
    if (samples.length < 2) return null;

    const width = 100;
    const height = 32;
    const values = samples.map((s) => s.observed);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1, max - min);

    const points = samples.map((sample, index) => {
      const x = (index / (samples.length - 1)) * width;
      const y = height - ((sample.observed - min) / span) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    return {
      line: `M ${points.join(" L ")}`,
      area: `M 0,${height} L ${points.join(" L ")} L ${width},${height} Z`,
      min,
      max,
    };
  }, [samples]);

  if (!path) {
    return (
      <p className="text-[12px] text-[var(--color-text-muted)]">
        Not enough retained samples yet. AETHERA records one aggregate per poll, so this
        fills in as it runs — there is no backfill.
      </p>
    );
  }

  return (
    <div>
      <svg
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        className="h-24 w-full"
        role="img"
        aria-label="Observed aircraft over time"
      >
        <path d={path.area} fill={ACCENT} opacity={0.12} />
        <path
          d={path.line}
          fill="none"
          stroke={ACCENT}
          strokeWidth={0.6}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between tabular-nums text-[10px] text-[var(--color-text-subtle)]">
        <span>low {path.min.toLocaleString()}</span>
        <span>{samples.length} samples</span>
        <span>peak {path.max.toLocaleString()}</span>
      </div>
    </div>
  );
}

function VerticalBalance({ summary }: { summary: AirspaceSample }) {
  const total = summary.climbing + summary.descending + summary.level;
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);

  const segments = [
    { label: "Climbing", value: summary.climbing, color: "var(--color-success)" },
    { label: "Level", value: summary.level, color: "var(--color-text-subtle)" },
    { label: "Descending", value: summary.descending, color: "var(--color-accent)" },
  ];

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        Climb / descent balance
      </h3>

      <div className="mt-3 flex h-3 overflow-hidden rounded-[2px] bg-[var(--color-surface-elevated)]">
        {segments.map((segment) => (
          <div
            key={segment.label}
            style={{ width: `${pct(segment.value)}%`, background: segment.color }}
            className="h-full"
          />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {segments.map((segment) => (
          <div key={segment.label}>
            <div className="tabular-nums text-[16px] text-[var(--color-text)]">
              {segment.value.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: segment.color }}
              />
              {segment.label}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[10px] text-[var(--color-text-subtle)]">
        Derived from observed vertical rate. Aircraft not reporting one are excluded
        rather than counted as level.
      </p>
    </section>
  );
}

const ALTITUDE_BOUNDS = [0, 1000, 5000, 10000, 20000, 30000, 40000];
const SPEED_BOUNDS = [0, 100, 200, 300, 400, 500, 600];

export function AnalyticsView() {
  const [summary, setSummary] = useState<AirspaceSample | null>(null);
  const [samples, setSamples] = useState<AirspaceSample[]>([]);
  const [hours, setHours] = useState(6);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [summaryResult, historyResult] = await Promise.all([
          fetchAnalyticsSummary(),
          fetchAnalyticsHistory(hours),
        ]);
        if (cancelled) return;
        setSummary(summaryResult.summary);
        setSamples(historyResult.samples);
        setError(false);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [hours]);

  return (
    <div className="h-full overflow-y-auto">
      <header className="border-b border-[var(--color-border)] px-5 py-4">
        <h1 className="text-[13px] font-medium uppercase tracking-[0.18em] text-[var(--color-text)]">
          Analytics
        </h1>
        <p className="mt-1 text-[11px] text-[var(--color-text-subtle)]">
          Everything here describes what AETHERA observed through its configured sources.
          It is not a complete picture of the sky.
        </p>
      </header>

      <div className="p-5">
        {error && !summary ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Analytics unavailable. Retrying.
          </p>
        ) : !summary ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">Loading airspace…</p>
        ) : (
          <div className="space-y-4">
            <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Observed", value: summary.observed },
                { label: "Airborne", value: summary.airborne },
                { label: "On ground", value: summary.onGround },
                { label: "Open conditions", value: summary.activeAnomalies },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
                >
                  <div className="tabular-nums text-[24px] leading-none text-[var(--color-text)]">
                    {stat.value.toLocaleString()}
                  </div>
                  <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                    {stat.label}
                  </div>
                </div>
              ))}
            </section>

            <VerticalBalance summary={summary} />

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
                  Observed aircraft over time
                </h3>
                <div className="flex gap-1">
                  {HISTORY_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setHours(option)}
                      aria-pressed={hours === option}
                      className={`rounded-[var(--radius-sm)] border px-2 py-0.5 text-[10px] tabular-nums transition-colors ${
                        hours === option
                          ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                          : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      {option}h
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <HistoryChart samples={samples} />
              </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <BandChart
                title="Altitude distribution"
                histogram={summary.altitudeBands}
                bounds={ALTITUDE_BOUNDS}
                unit="ft"
                note="Airborne aircraft only. Those not reporting altitude are excluded."
              />
              <BandChart
                title="Ground speed distribution"
                histogram={summary.speedBands}
                bounds={SPEED_BOUNDS}
                unit="kt"
                note="Includes aircraft on the ground, which is why the lowest band is populated."
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
