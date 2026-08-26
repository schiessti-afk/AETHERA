"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BoundingBox, FlightState } from "@aethera/types";
import { dataAgeSeconds, interpolatePosition, positionConfidence } from "@aethera/flight-engine";
import { mapStyleUrl } from "@/lib/config";
import { flightStore } from "@/lib/flight-store";
import { useFlightConnection, useFlightStore } from "@/hooks/use-flight-store";
import { AIRCRAFT_ICON_ATLAS, AIRCRAFT_ICON_MAPPING } from "@/lib/aircraft-icon";
import { AircraftPanel } from "@/components/aircraft-panel";
import { FilterBar, type Filters, defaultFilters, applyFilters } from "@/components/filter-bar";
import { CommandPalette } from "@/components/command-palette";

const COLOR_DEFAULT: [number, number, number] = [139, 155, 176]; // --color-text-muted
const COLOR_GROUND: [number, number, number] = [93, 109, 130]; // --color-text-subtle
const COLOR_HOVER: [number, number, number] = [232, 238, 246]; // --color-text
const COLOR_SELECTED: [number, number, number] = [62, 224, 200]; // --color-accent
const COLOR_STALE: [number, number, number] = [93, 109, 130];

const VIEWPORT_DEBOUNCE_MS = 350;

function boundsFromMap(map: import("maplibre-gl").Map): BoundingBox {
  const b = map.getBounds();
  return {
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
  };
}

export function MapViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const overlayRef = useRef<import("@deck.gl/mapbox").MapboxOverlay | null>(null);
  const rafRef = useRef<number | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const [is3D, setIs3D] = useState(true);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useFlightConnection();
  const { selected, followed } = useFlightStore();

  // --- Map + deck.gl overlay setup -----------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let viewportTimer: ReturnType<typeof setTimeout> | undefined;

    async function createMap() {
      const [maplibregl, { MapboxOverlay }, { IconLayer, LineLayer }] = await Promise.all([
        import("maplibre-gl"),
        import("@deck.gl/mapbox"),
        import("@deck.gl/layers"),
      ]);
      const { Map } = maplibregl;
      if (cancelled || !container) return;

      // maplibre-gl's tile-parsing worker resolves its own URL via import.meta.url;
      // once webpack rebundles that into a Next.js chunk, the computed URL points
      // nowhere real and the worker silently never starts — the map hangs forever
      // "loading" with a blank canvas. Point it at the static copy instead
      // (kept in sync by scripts/sync-maplibre-worker.mjs, see predev/prebuild).
      maplibregl.setWorkerUrl("/maplibre-gl-worker.js");

      const map = new Map({
        container,
        style: mapStyleUrl,
        center: [8, 48],
        zoom: 3.6,
        pitch: 42,
        bearing: -18,
        maxPitch: 80,
        attributionControl: { compact: true },
      });
      mapRef.current = map;

      // @deck.gl/mapbox's integration with this maplibre-gl release doesn't get along
      // with the "globe" projection: with globe on, every frame throws reading an
      // undefined `.height` deep in maplibre-gl.mjs (deck.gl's view-state sync reads
      // map.transform.height, which globe's Transform doesn't expose the way deck.gl 9.3
      // expects) — confirmed by bisecting globe/deck.gl/render-loop independently across
      // clean tabs and dev-server restarts. Even switching to overlaid mode (deck.gl's own
      // canvas, no interleaving) doesn't help: no crash, but nothing draws under globe
      // either, since deck.gl never gets a usable view state from it. Mercator + pitch is
      // what actually delivers "altitude as height above the map" per spec §15.1 — globe
      // was our own addition on top of that, not a requirement, so it's dropped rather
      // than fought. Overlaid mode is also kept over interleaved: interleaved still threw
      // intermittently even with globe off, where overlaid was reliably clean; the cost is
      // depth-sorting against terrain (irrelevant with no terrain layer yet) rather than
      // true 3D.
      const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      overlayRef.current = overlay;

      map.on("load", () => {
        if (cancelled) return;
        map.addControl(overlay as unknown as import("maplibre-gl").IControl);
        flightStore.setBounds(boundsFromMap(map));
        startRenderLoop(IconLayer, LineLayer);
      });

      map.on("moveend", () => {
        if (viewportTimer) clearTimeout(viewportTimer);
        viewportTimer = setTimeout(() => {
          if (!cancelled) flightStore.setBounds(boundsFromMap(map));
        }, VIEWPORT_DEBOUNCE_MS);
      });

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container);
    }

    function startRenderLoop(
      IconLayer: typeof import("@deck.gl/layers").IconLayer,
      LineLayer: typeof import("@deck.gl/layers").LineLayer,
    ) {
      const tick = () => {
        if (cancelled) return;
        renderFrame(IconLayer, LineLayer);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    function renderFrame(
      IconLayer: typeof import("@deck.gl/layers").IconLayer,
      LineLayer: typeof import("@deck.gl/layers").LineLayer,
    ) {
      const overlay = overlayRef.current;
      const map = mapRef.current;
      if (!overlay || !map) return;

      const now = Date.now();
      const { aircraft, selected, followed, hovered, trailVisible } = flightStore.getSnapshot();
      const visible = applyFilters(Array.from(aircraft.values()), filtersRef.current);

      type RenderPoint = {
        flight: FlightState;
        position: [number, number];
        confidence: number;
        stale: boolean;
      };

      const points: RenderPoint[] = visible.map((flight) => {
        const pos = interpolatePosition(flight, now);
        const ageS = dataAgeSeconds(flight.lastSeen, now);
        return {
          flight,
          position: [pos.longitude, pos.latitude],
          confidence: positionConfidence(ageS),
          stale: ageS > 180,
        };
      });

      const iconLayer = new IconLayer<RenderPoint>({
        id: "aircraft",
        data: points,
        pickable: true,
        iconAtlas: AIRCRAFT_ICON_ATLAS,
        iconMapping: AIRCRAFT_ICON_MAPPING,
        getIcon: () => "aircraft",
        sizeUnits: "pixels",
        getPosition: (d) => d.position,
        getSize: (d) => (d.flight.icao24 === selected ? 30 : d.flight.icao24 === followed ? 30 : 22),
        // deck.gl IconLayer rotates clockwise from the icon's own up axis; our glyph
        // is drawn north-up, and `heading` is compass degrees. Unverified against a
        // live feed (no OpenSky access in this environment) — check against real
        // traffic and flip the sign if aircraft appear to fly backwards.
        getAngle: (d) => 360 - (d.flight.heading ?? 0),
        getColor: (d) => {
          const alpha = Math.round(255 * (d.flight.onGround ? 0.55 : 1) * (d.stale ? 0.6 : 1) * Math.max(0.35, d.confidence));
          if (d.flight.icao24 === selected || d.flight.icao24 === followed) {
            return [...COLOR_SELECTED, alpha];
          }
          if (d.flight.icao24 === hovered) return [...COLOR_HOVER, alpha];
          if (d.stale) return [...COLOR_STALE, alpha];
          return [...(d.flight.onGround ? COLOR_GROUND : COLOR_DEFAULT), alpha];
        },
        updateTriggers: {
          getColor: [selected, followed, hovered],
          getSize: [selected, followed],
        },
        onClick: (info) => {
          const flight = (info.object as RenderPoint | null)?.flight;
          flightStore.select(flight?.icao24 ?? null);
        },
        onHover: (info) => {
          const icao24 = (info.object as RenderPoint | null)?.flight.icao24 ?? null;
          if (hoveredRef.current !== icao24) {
            hoveredRef.current = icao24;
            flightStore.hover(icao24);
          }
        },
      });

      const layers: import("@deck.gl/core").Layer[] = [iconLayer];

      const trailId = trailVisible ? (selected ?? followed) : null;
      if (trailId) {
        const trail = flightStore.getTrail(trailId);
        if (trail.length > 1) {
          const segments = trail.slice(1).map((point, i) => ({
            source: [trail[i].longitude, trail[i].latitude] as [number, number],
            target: [point.longitude, point.latitude] as [number, number],
            age: i / trail.length,
          }));
          layers.unshift(
            new LineLayer({
              id: "trail",
              data: segments,
              getSourcePosition: (d) => d.source,
              getTargetPosition: (d) => d.target,
              getColor: (d) => [...COLOR_SELECTED, Math.round(40 + 180 * d.age)],
              getWidth: 2,
              widthUnits: "pixels",
            }),
          );
        }
      }

      overlay.setProps({ layers });

      // Follow mode: keep the camera on the followed aircraft without fighting user drag.
      if (followed) {
        const followedPoint = points.find((p) => p.flight.icao24 === followed);
        if (followedPoint) {
          map.jumpTo({ center: followedPoint.position });
        }
      }
    }

    void createMap();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (viewportTimer) clearTimeout(viewportTimer);
      resizeObserver?.disconnect();
      overlayRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // --- 2D / 3D toggle: preserve location, selection, filters ---------------
  const toggleProjection = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = !is3D;
    setIs3D(next);
    map.easeTo({ pitch: next ? 42 : 0, duration: 400 });
  }, [is3D]);

  const flyTo = useCallback((longitude: number, latitude: number) => {
    mapRef.current?.easeTo({ center: [longitude, latitude], zoom: 9, duration: 900 });
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--color-background)]">
      <div ref={containerRef} className="absolute inset-0" />

      <CommandPalette onSelectAircraft={(icao24) => flightStore.select(icao24)} onFlyTo={flyTo} />

      <div className="absolute left-3 top-3 z-[var(--z-controls)]">
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      <div className="absolute right-3 top-3 z-[var(--z-controls)] flex flex-col gap-1">
        <button
          type="button"
          onClick={toggleProjection}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] shadow-[var(--shadow-panel)] transition-colors hover:text-[var(--color-text)]"
          aria-pressed={is3D}
        >
          {is3D ? "3D" : "2D"}
        </button>
      </div>

      {selected && (
        <div className="absolute bottom-3 right-3 z-[var(--z-panels)] w-[320px] max-w-[calc(100vw-1.5rem)]">
          <AircraftPanel
            icao24={selected}
            isFollowed={followed === selected}
            onClose={() => flightStore.select(null)}
            onFollow={() => flightStore.follow(followed === selected ? null : selected)}
            onRecenter={(lon, lat) => flyTo(lon, lat)}
          />
        </div>
      )}
    </div>
  );
}
