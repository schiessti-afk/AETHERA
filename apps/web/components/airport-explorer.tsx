"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import type { Airport } from "@aethera/types";
import {
  fetchAirportTraffic,
  fetchAirports,
  type AirportTraffic,
  type TrafficRelation,
} from "@/lib/api";
import { flightStore } from "@/lib/flight-store";
import { formatOrDash, formatRelativeTime } from "@/lib/format";

/**
 * Deliberately geometric wording. These describe where an aircraft was observed
 * relative to the airport, not what it is scheduled to do — an aircraft descending
 * near Heathrow may be descending toward Gatwick. PRODUCT_SPEC §19.2 rules out
 * presenting any of this as an arrivals or departures board.
 */
const RELATION_LABEL: Record<TrafficRelation, string> = {
  on_ground: "On ground",
  descending: "Descending nearby",
  climbing: "Climbing out",
  level: "Level nearby",
  overflight: "Overflying",
};

const RELATION_COLOR: Record<TrafficRelation, string> = {
  on_ground: "text-[var(--color-text-subtle)]",
  descending: "text-[var(--color-accent)]",
  climbing: "text-[var(--color-success)]",
  level: "text-[var(--color-text-muted)]",
  overflight: "text-[var(--color-text-subtle)]",
};

const RELATION_ORDER: TrafficRelation[] = [
  "descending",
  "climbing",
  "on_ground",
  "level",
  "overflight",
];

const REFRESH_MS = 20_000;

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-1.5">
      <div className="tabular-nums text-[16px] text-[var(--color-text)]">{value}</div>
      <div className="text-[9px] uppercase leading-tight tracking-[0.1em] text-[var(--color-text-subtle)]">
        {label}
      </div>
    </div>
  );
}

export function AirportExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedIcao = searchParams.get("icao");
  const [query, setQuery] = useState(linkedIcao ?? "");
  const [airports, setAirports] = useState<Airport[]>([]);
  const [selected, setSelected] = useState<string | null>(linkedIcao);
  const [traffic, setTraffic] = useState<AirportTraffic | null>(null);
  const [loading, setLoading] = useState(false);

  /** Deep link from the Explore airport peek: preselect and filter to that airport. */
  useEffect(() => {
    if (!linkedIcao) return;
    setQuery(linkedIcao);
    setSelected(linkedIcao);
  }, [linkedIcao]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await fetchAirports({ q: query.trim() || undefined, limit: 60 });
        if (!cancelled) setAirports(result.airports);
      } catch {
        if (!cancelled) setAirports([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const loadTraffic = useCallback(async (icao: string) => {
    setLoading(true);
    try {
      const result = await fetchAirportTraffic(icao);
      setTraffic(result);
    } catch {
      setTraffic(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    void loadTraffic(selected);
    const id = setInterval(() => void loadTraffic(selected), REFRESH_MS);
    return () => clearInterval(id);
  }, [selected, loadTraffic]);

  const grouped = useMemo(() => {
    if (!traffic) return [];
    return RELATION_ORDER.map((relation) => ({
      relation,
      entries: traffic.traffic.filter((t) => t.relation === relation),
    })).filter((group) => group.entries.length > 0);
  }, [traffic]);

  const focusOnMap = (longitude: number, latitude: number) => {
    flightStore.requestFlyTo(longitude, latitude);
    router.push("/");
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Directory */}
      <div className="flex w-[300px] shrink-0 flex-col border-r border-[var(--color-border)]">
        <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-4">
          <h1 className="text-[13px] font-medium uppercase tracking-[0.18em] text-[var(--color-text)]">
            Airports
          </h1>
          <div className="relative mt-3">
            <Search
              size={13}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-text-subtle)]"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, city, ICAO or IATA"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] py-1.5 pl-7 pr-2 text-[12px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {airports.length === 0 ? (
            <p className="px-3 py-6 text-[12px] text-[var(--color-text-muted)]">
              {query.trim() ? "No airport matches that." : "No airports available."}
            </p>
          ) : (
            airports.map((airport) => (
              <button
                key={airport.icao}
                type="button"
                onClick={() => setSelected(airport.icao)}
                className={`w-full rounded-[var(--radius-sm)] px-3 py-2 text-left transition-colors ${
                  selected === airport.icao
                    ? "bg-[var(--color-surface-selected)]"
                    : "hover:bg-[var(--color-surface-elevated)]"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] text-[var(--color-text)]">
                    {airport.name}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-accent)]">
                    {airport.iata ?? airport.icao}
                  </span>
                </div>
                <div className="truncate text-[11px] text-[var(--color-text-subtle)]">
                  {[airport.city, airport.country].filter(Boolean).join(", ")}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {!selected ? (
          <div className="flex h-full items-center justify-center p-8">
            <p className="max-w-sm text-center text-[13px] text-[var(--color-text-muted)]">
              Select an airport to see the traffic AETHERA is observing around it.
            </p>
          </div>
        ) : !traffic ? (
          <div className="flex h-full items-center justify-center p-8">
            <p className="text-[13px] text-[var(--color-text-muted)]">
              {loading ? "Loading observed traffic…" : "Traffic unavailable."}
            </p>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex items-baseline justify-between gap-4">
              <div className="min-w-0">
                <h2 className="truncate text-[15px] text-[var(--color-text)]">
                  {traffic.airport.name}
                </h2>
                <p className="text-[11px] text-[var(--color-text-subtle)]">
                  {traffic.airport.icao}
                  {traffic.airport.iata ? ` · ${traffic.airport.iata}` : ""}
                  {traffic.airport.city ? ` · ${traffic.airport.city}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  focusOnMap(traffic.airport.longitude, traffic.airport.latitude)
                }
                className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                Show on map
              </button>
            </div>

            <p className="mt-3 text-[11px] text-[var(--color-text-subtle)]">
              Observed aircraft within {traffic.radiusKm} km. These are positions AETHERA
              observed, not an arrivals or departures board.
            </p>

            <div className="mt-4 grid grid-cols-5 gap-2">
              <Stat label="Descending" value={traffic.counts.descending} />
              <Stat label="Climbing" value={traffic.counts.climbing} />
              <Stat label="On ground" value={traffic.counts.on_ground} />
              <Stat label="Level" value={traffic.counts.level} />
              <Stat label="Overflying" value={traffic.counts.overflight} />
            </div>

            {traffic.total === 0 ? (
              <p className="mt-6 text-[13px] text-[var(--color-text-muted)]">
                No aircraft observed within {traffic.radiusKm} km right now.
              </p>
            ) : (
              <div className="mt-5 space-y-5">
                {grouped.map((group) => (
                  <div key={group.relation}>
                    <div
                      className={`mb-1.5 text-[10px] uppercase tracking-[0.14em] ${
                        RELATION_COLOR[group.relation]
                      }`}
                    >
                      {RELATION_LABEL[group.relation]} · {group.entries.length}
                    </div>
                    <div className="divide-y divide-[var(--color-border)]">
                      {group.entries.map((entry) => (
                        <button
                          key={entry.icao24}
                          type="button"
                          onClick={() => {
                            flightStore.select(entry.icao24);
                            focusOnMap(entry.longitude, entry.latitude);
                          }}
                          className="flex w-full items-center justify-between gap-3 py-1.5 text-left hover:bg-[var(--color-surface-elevated)]"
                        >
                          <span className="min-w-0 truncate text-[13px] text-[var(--color-text)]">
                            {formatOrDash(entry.callsign)}
                            <span className="ml-2 text-[var(--color-text-subtle)]">
                              {entry.icao24.toUpperCase()}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-[11px] text-[var(--color-text-muted)]">
                            {entry.altitudeFt != null
                              ? `${entry.altitudeFt.toLocaleString()} ft`
                              : "—"}
                            <span className="ml-3 text-[var(--color-text-subtle)]">
                              {entry.distanceKm} km
                            </span>
                            <span className="ml-3 text-[var(--color-text-subtle)]">
                              {formatRelativeTime(entry.lastSeen)}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
