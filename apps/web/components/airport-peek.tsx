"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { Airport } from "@aethera/types";
import { fetchAirportTraffic, type AirportTraffic } from "@/lib/api";

/**
 * Compact airport context on the map.
 *
 * PRODUCT_SPEC §19.3: selecting an airport "opens a compact airport panel, not a
 * full-page brochure". The full directory lives on the Airports surface; this exists so
 * a user can read an airport without leaving Explore.
 */
export function AirportPeek({
  airport,
  onClose,
  onFocus,
}: {
  airport: Airport;
  onClose: () => void;
  onFocus: (longitude: number, latitude: number) => void;
}) {
  const [traffic, setTraffic] = useState<AirportTraffic | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTraffic(null);
    fetchAirportTraffic(airport.icao)
      .then((result) => {
        if (!cancelled) setTraffic(result);
      })
      .catch(() => {
        if (!cancelled) setTraffic(null);
      });
    return () => {
      cancelled = true;
    };
  }, [airport.icao]);

  const counts = traffic?.counts;

  return (
    <div className="w-[268px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-panel)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] text-[var(--color-text)]">
            {airport.name}
          </div>
          <div className="text-[11px] text-[var(--color-text-subtle)]">
            {airport.icao}
            {airport.iata ? ` · ${airport.iata}` : ""}
            {airport.city ? ` · ${airport.city}` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <X size={14} />
        </button>
      </div>

      {counts ? (
        <>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {[
              { label: "Desc", value: counts.descending },
              { label: "Climb", value: counts.climbing },
              { label: "Ground", value: counts.on_ground },
              { label: "Over", value: counts.overflight },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-1.5 py-1 text-center"
              >
                <div className="tabular-nums text-[14px] text-[var(--color-text)]">
                  {stat.value}
                </div>
                <div className="text-[9px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-[var(--color-text-subtle)]">
            Observed within {traffic?.radiusKm} km. Not an arrivals board.
          </p>
        </>
      ) : (
        <p className="mt-3 text-[11px] text-[var(--color-text-muted)]">
          Reading observed traffic…
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onFocus(airport.longitude, airport.latitude)}
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          Centre
        </button>
        <Link
          href="/airports"
          className="flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] py-1 text-center text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
        >
          Details
        </Link>
      </div>
    </div>
  );
}
