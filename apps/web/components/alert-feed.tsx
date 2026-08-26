"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Anomaly, AnomalySeverity, AnomalyType } from "@aethera/types";
import { anomalyLabel } from "@aethera/anomaly-engine";
import { fetchAnomalies, type AnomalyFeed } from "@/lib/api";
import { flightStore } from "@/lib/flight-store";
import { formatAltitude, formatOrDash, formatRelativeTime } from "@/lib/format";

/** Design §8: severity maps onto the alert colour hierarchy, never onto louder copy. */
const SEVERITY_STYLE: Record<AnomalySeverity, { dot: string; text: string }> = {
  critical: { dot: "bg-[var(--color-danger)]", text: "text-[var(--color-danger)]" },
  high: { dot: "bg-[var(--color-alert)]", text: "text-[var(--color-alert)]" },
  medium: { dot: "bg-[var(--color-warning)]", text: "text-[var(--color-warning)]" },
  info: { dot: "bg-[var(--color-text-subtle)]", text: "text-[var(--color-text-muted)]" },
};

const SEVERITIES: AnomalySeverity[] = ["critical", "high", "medium"];
const TYPES: Array<{ value: AnomalyType; label: string }> = [
  { value: "EMERGENCY_SQUAWK", label: "Squawk" },
  { value: "RAPID_DESCENT", label: "Descent" },
  { value: "RAPID_CLIMB", label: "Climb" },
  { value: "LOST_SIGNAL", label: "Signal" },
];

const REFRESH_MS = 15_000;

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[var(--radius-sm)] border px-2 py-1 text-[10px] uppercase tracking-[0.14em] transition-colors ${
        active
          ? "border-[var(--color-accent)] text-[var(--color-accent)]"
          : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      {children}
    </button>
  );
}

function AlertRow({ anomaly, onFocus }: { anomaly: Anomaly; onFocus: () => void }) {
  const style = SEVERITY_STYLE[anomaly.severity];
  // Only state conditions have an open/closed life. A kinematic detection is a single
  // observation, so it is never dimmed as "resolved" nor implied to be ongoing.
  const isCondition = anomaly.kind === "state";
  const resolved = isCondition && Boolean(anomaly.resolvedAt);

  return (
    <button
      type="button"
      onClick={onFocus}
      className={`flex w-full items-start gap-3 rounded-[var(--radius-md)] border border-transparent px-3 py-3 text-left transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-selected)] ${
        resolved ? "opacity-55" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`}
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-[12px] font-medium tracking-[0.12em] ${style.text}`}>
          {anomalyLabel(anomaly)}
        </span>
        <span className="mt-0.5 block text-[13px] text-[var(--color-text)]">
          {formatOrDash(anomaly.callsign)}
          <span className="ml-2 text-[var(--color-text-subtle)]">
            {anomaly.icao24.toUpperCase()}
          </span>
        </span>
        <span className="mt-0.5 block text-[11px] text-[var(--color-text-muted)]">
          {anomaly.altitude != null ? `${formatAltitude(anomaly.altitude)} · ` : ""}
          {formatRelativeTime(anomaly.detectedAt)}
          {resolved ? " · resolved" : isCondition ? " · ongoing" : ""}
        </span>
      </span>
    </button>
  );
}

export function AlertFeed() {
  const router = useRouter();
  const [feed, setFeed] = useState<AnomalyFeed | null>(null);
  const [error, setError] = useState(false);
  const [severity, setSeverity] = useState<AnomalySeverity[]>([]);
  const [types, setTypes] = useState<AnomalyType[]>([]);

  const load = useCallback(async () => {
    try {
      const next = await fetchAnomalies({ severity, type: types });
      setFeed(next);
      setError(false);
      flightStore.seedAlerts(next.anomalies);
    } catch {
      setError(true);
    }
  }, [severity, types]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const toggle = <T,>(list: T[], value: T, set: (next: T[]) => void) => {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const focusAircraft = useCallback(
    (anomaly: Anomaly) => {
      // Selecting before navigating means Explore opens with the panel already on the
      // right aircraft rather than flickering through an unselected frame.
      flightStore.select(anomaly.icao24);
      if (anomaly.longitude != null && anomaly.latitude != null) {
        flightStore.requestFlyTo(anomaly.longitude, anomaly.latitude);
      }
      router.push("/");
    },
    [router],
  );

  const filtersActive = severity.length > 0 || types.length > 0;
  const anomalies = feed?.anomalies ?? [];

  const summary = useMemo(() => {
    if (!feed) return null;
    const conditions = feed.active === 1 ? "1 ongoing condition" : `${feed.active} ongoing conditions`;
    return `${conditions} · ${feed.total} detections in the last 15 minutes`;
  }, [feed]);

  return (
    <div className="flex h-full flex-col">
      <header className="shrink-0 border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-[13px] font-medium uppercase tracking-[0.18em] text-[var(--color-text)]">
            Alerts
          </h1>
          {summary ? (
            <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
              {summary}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-[var(--color-text-subtle)]">
          Detected conditions in observed transponder data. Not confirmed incidents.
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {SEVERITIES.map((value) => (
            <Chip
              key={value}
              active={severity.includes(value)}
              onClick={() => toggle(severity, value, setSeverity)}
            >
              {value}
            </Chip>
          ))}
          <span className="mx-1 w-px bg-[var(--color-border)]" aria-hidden="true" />
          {TYPES.map((item) => (
            <Chip
              key={item.value}
              active={types.includes(item.value)}
              onClick={() => toggle(types, item.value, setTypes)}
            >
              {item.label}
            </Chip>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {error ? (
          <p className="px-3 py-6 text-sm text-[var(--color-text-muted)]">
            Alert feed unavailable. Retrying.
          </p>
        ) : anomalies.length === 0 ? (
          <p className="px-3 py-6 text-sm text-[var(--color-text-muted)]">
            {filtersActive
              ? "No detections match these filters."
              : "No detected conditions in the last 15 minutes."}
          </p>
        ) : (
          anomalies.map((anomaly) => (
            <AlertRow
              key={`${anomaly.id}-${anomaly.detectedAt}`}
              anomaly={anomaly}
              onFocus={() => focusAircraft(anomaly)}
            />
          ))
        )}
      </div>
    </div>
  );
}
