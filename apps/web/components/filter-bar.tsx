"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { FlightState } from "@aethera/types";

export type VerticalFilter = "any" | "climbing" | "descending" | "level";

export interface Filters {
  altitudeMinFt: number | null;
  altitudeMaxFt: number | null;
  showGround: boolean;
  squawk: string;
  vertical: VerticalFilter;
}

export const defaultFilters: Filters = {
  altitudeMinFt: null,
  altitudeMaxFt: null,
  showGround: true,
  squawk: "",
  vertical: "any",
};

const FT_TO_M = 0.3048;
const MPS_TO_FPM = 196.85;
/** Below this rate an aircraft reads as holding level rather than climbing or descending. */
const LEVEL_FPM = 300;

export function applyFilters(aircraft: FlightState[], filters: Filters): FlightState[] {
  const squawk = filters.squawk.trim();

  return aircraft.filter((flight) => {
    if (!filters.showGround && flight.onGround) return false;

    if (squawk && flight.squawk !== squawk) return false;

    if (filters.vertical !== "any") {
      // An unreported vertical rate is unknown, not level — filtering on it would
      // assert something the data does not say (§12.3).
      if (flight.verticalRate == null) return false;
      const fpm = flight.verticalRate * MPS_TO_FPM;
      if (filters.vertical === "climbing" && fpm <= LEVEL_FPM) return false;
      if (filters.vertical === "descending" && fpm >= -LEVEL_FPM) return false;
      if (filters.vertical === "level" && Math.abs(fpm) > LEVEL_FPM) return false;
    }

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
    filters.altitudeMinFt != null ||
    filters.altitudeMaxFt != null ||
    !filters.showGround ||
    filters.squawk.trim() !== "" ||
    filters.vertical !== "any";

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

          <div className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
            Vertical
          </div>
          <div className="flex gap-1">
            {(["any", "climbing", "descending", "level"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...filters, vertical: value })}
                aria-pressed={filters.vertical === value}
                className={`flex-1 rounded-[var(--radius-sm)] border py-1 text-[9px] uppercase tracking-[0.1em] transition-colors ${
                  filters.vertical === value
                    ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {value === "any" ? "All" : value.slice(0, 4)}
              </button>
            ))}
          </div>

          <div className="mb-1 mt-3 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
            Squawk
          </div>
          <input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 7700"
            maxLength={4}
            value={filters.squawk}
            onChange={(e) => onChange({ ...filters, squawk: e.target.value })}
            className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-2 py-1 tabular-nums text-[var(--color-text)]"
          />

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
