"use client";

import { useEffect, useRef, useState } from "react";
import type { FlightState } from "@aethera/types";
import { search as searchApi } from "@/lib/api";
import { formatAltitude, formatOrDash } from "@/lib/format";

interface AirportResult {
  icao: string;
  iata?: string;
  name: string;
  latitude?: number;
  longitude?: number;
}

export function CommandPalette({
  onSelectAircraft,
  onFlyTo,
}: {
  onSelectAircraft: (icao24: string) => void;
  onFlyTo: (longitude: number, latitude: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [aircraft, setAircraft] = useState<FlightState[]>([]);
  const [airports, setAirports] = useState<AirportResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isCombo = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCombo) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("aethera:open-search", onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("aethera:open-search", onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setQuery("");
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setAircraft([]);
      setAirports([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await searchApi(query.trim());
        if (!cancelled) {
          setAircraft(result.aircraft);
          setAirports(result.airports as AirportResult[]);
        }
      } catch {
        if (!cancelled) {
          setAircraft([]);
          setAirports([]);
        }
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const noResults = query.trim().length >= 2 && aircraft.length === 0 && airports.length === 0;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[var(--z-dialog)] flex items-start justify-center bg-black/40 pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-panel)]"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Callsign, ICAO24, or airport"
              className="w-full border-b border-[var(--color-border)] bg-transparent px-4 py-3 text-sm text-[var(--color-text)] outline-none"
            />

            <div className="max-h-80 overflow-y-auto p-2 text-sm">
              {noResults && (
                <p className="px-2 py-3 text-[var(--color-text-muted)]">
                  No match for “{query.trim()}”
                </p>
              )}

              {aircraft.map((flight) => (
                <button
                  key={flight.icao24}
                  type="button"
                  onClick={() => {
                    onSelectAircraft(flight.icao24);
                    onFlyTo(flight.longitude, flight.latitude);
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-2 text-left hover:bg-[var(--color-surface-selected)]"
                >
                  <span className="text-[var(--color-text)]">
                    {formatOrDash(flight.callsign)}
                    <span className="ml-2 text-[var(--color-text-subtle)]">
                      {flight.icao24.toUpperCase()}
                    </span>
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    {formatAltitude(flight.altitude)}
                  </span>
                </button>
              ))}

              {airports.map((airport) => (
                <button
                  key={airport.icao}
                  type="button"
                  onClick={() => {
                    if (airport.longitude != null && airport.latitude != null) {
                      onFlyTo(airport.longitude, airport.latitude);
                    }
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-[var(--radius-sm)] px-2 py-2 text-left hover:bg-[var(--color-surface-selected)]"
                >
                  <span className="text-[var(--color-text)]">{airport.name}</span>
                  <span className="text-[var(--color-text-muted)]">
                    {airport.iata ?? airport.icao}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
