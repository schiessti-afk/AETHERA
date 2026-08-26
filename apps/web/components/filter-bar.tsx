"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { FlightState } from "@aethera/types";

export interface Filters {
  altitudeMinFt: number | null;
  altitudeMaxFt: number | null;
  showGround: boolean;
}

export const defaultFilters: Filters = {
  altitudeMinFt: null,
  altitudeMaxFt: null,
  showGround: true,
};

const FT_TO_M = 0.3048;

export function applyFilters(aircraft: FlightState[], filters: Filters): FlightState[] {
  return aircraft.filter((flight) => {
    if (!filters.showGround && flight.onGround) return false;
    if (flight.altitude == null) return true; // don't hide unknowns per spec §12.3
    if (filters.altitudeMinFt != null && flight.altitude < filters.altitudeMinFt * FT_TO_M) {
      return false;
    }
    if (filters.altitudeMaxFt != null && flight.altitude > filters.altitudeMaxFt * FT_TO_M) {
      return false;
    }
    return true;
  });
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
}) {
  const [open, setOpen] = useState(false);
  const active =
    filters.altitudeMinFt != null || filters.altitudeMaxFt != null || !filters.showGround;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-pressed={active}
        className={`flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] shadow-[var(--shadow-panel)] transition-colors ${
          active ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"
        }`}
      >
        <SlidersHorizontal size={13} strokeWidth={1.6} />
        Filters
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] w-56 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[11px] shadow-[var(--shadow-panel)]">
          <label className="mb-2 flex items-center justify-between text-[var(--color-text-muted)]">
            <span>Show ground traffic</span>
            <input
              type="checkbox"
              checked={filters.showGround}
              onChange={(e) => onChange({ ...filters, showGround: e.target.checked })}
            />
          </label>

          <div className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
            Altitude (ft)
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Min"
              value={filters.altitudeMinFt ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  altitudeMinFt: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-[var(--color-text)]"
            />
            <span className="text-[var(--color-text-subtle)]">–</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.altitudeMaxFt ?? ""}
              onChange={(e) =>
                onChange({
                  ...filters,
                  altitudeMaxFt: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 text-[var(--color-text)]"
            />
          </div>

          {active && (
            <button
              type="button"
              onClick={() => onChange(defaultFilters)}
              className="mt-3 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
