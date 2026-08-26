import type { ConnectionStatus } from "@aethera/types";

const labels: Record<ConnectionStatus, string> = {
  LIVE: "LIVE",
  CONNECTING: "CONNECTING",
  DELAYED: "DELAYED",
  DEGRADED: "DEGRADED",
  OFFLINE: "OFFLINE",
};

const marks: Record<ConnectionStatus, string> = {
  LIVE: "●",
  CONNECTING: "◌",
  DELAYED: "△",
  DEGRADED: "△",
  OFFLINE: "○",
};

const colors: Record<ConnectionStatus, string> = {
  LIVE: "text-[var(--color-accent)]",
  CONNECTING: "text-[var(--color-text-muted)]",
  DELAYED: "text-[var(--color-warning)]",
  DEGRADED: "text-[var(--color-warning)]",
  OFFLINE: "text-[var(--color-text-subtle)]",
};

export function StatusIndicator({
  status,
  ageLabel,
}: {
  status: ConnectionStatus;
  ageLabel?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-[11px] font-medium tracking-[0.14em] uppercase ${colors[status]}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">{marks[status]}</span>
      <span>{labels[status]}</span>
      {ageLabel ? (
        <span className="text-[var(--color-text-subtle)] normal-case tracking-normal">
          {ageLabel}
        </span>
      ) : null}
    </div>
  );
}
