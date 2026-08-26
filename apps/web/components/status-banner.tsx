"use client";

import type { ConnectionStatus } from "@aethera/types";

/**
 * Explains failure without replacing the map — spec §22.3: keep the last known
 * picture visible, say what happened, say whether the system is reconnecting.
 * STALE/DELAYED stay ambient (the status pill in the header carries them);
 * this banner is reserved for the two states where the picture may be wrong,
 * not just old.
 */
export function StatusBanner({
  status,
  lastError,
  onRetry,
}: {
  status: ConnectionStatus;
  lastError: string | null;
  onRetry: () => void;
}) {
  if (status !== "OFFLINE" && status !== "DEGRADED") return null;

  const isOffline = status === "OFFLINE";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto absolute left-1/2 top-[60px] z-[var(--z-panels)] w-[min(420px,calc(100vw-1.5rem))] -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-center shadow-[var(--shadow-panel)]"
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--color-alert)]">
        {isOffline ? "Live data unavailable" : "Airspace data delayed"}
      </div>
      <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
        {isOffline
          ? "Attempting to reconnect to the airspace data service. The last observed positions stay on the map."
          : lastError
            ? `The data source reported an issue: ${lastError}. Retrying automatically.`
            : "The upstream data source is degraded. Retrying automatically."}
      </p>
      {isOffline && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}
