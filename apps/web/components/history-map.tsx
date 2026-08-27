"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Airport, BoundingBox, FlightState } from "@aethera/types";
import { dataAgeSeconds, positionConfidence } from "@aethera/flight-engine";
import { mapStyleUrl } from "@/lib/config";
import { fetchAirports } from "@/lib/api";
import { AIRCRAFT_ICON_ATLAS, AIRCRAFT_ICON_MAPPING } from "@/lib/aircraft-icon";
import {
  AIRPORT_MIN_ZOOM,
  COLOR_AIRPORT,
  COLOR_DEFAULT,
  COLOR_GROUND,
  COLOR_HOVER,
  COLOR_LABEL,
  COLOR_SELECTED,
  COLOR_STALE,
  LABEL_MAX_VISIBLE,
  LABEL_MIN_ZOOM,
  formatReplayTimestamp,
  iconSizeForZoom,
} from "@/lib/map-style";
import { replayStore } from "@/lib/replay-store";
import { useReplayStore } from "@/hooks/use-replay-store";
import { AircraftPanel } from "@/components/aircraft-panel";
import { FilterBar, type Filters, defaultFilters, applyFilters } from "@/components/filter-bar";

const VIEWPORT_DEBOUNCE_MS = 350;
const FOLLOW_MIN_INTERVAL_MS = 400;
const FOLLOW_EASE_MS = 600;
const FOLLOW_RECENTRE_PX = 60;

export function boundsFromMap(map: import("maplibre-gl").Map): BoundingBox {
  const b = map.getBounds();
  return {
    west: b.getWest(),
    south: b.getSouth(),
    east: b.getEast(),
    north: b.getNorth(),
  };
}

export function HistoryMap({
  onBounds,
}: {
  onBounds: (bounds: BoundingBox) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const overlayRef = useRef<import("@deck.gl/mapbox").MapboxOverlay | null>(null);
  const rafRef = useRef<number | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const lastFollowMoveRef = useRef(0);
  const lastFrameRef = useRef<number | null>(null);
  const [is3D, setIs3D] = useState(true);
  const airportsRef = useRef<Airport[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const { selected, followed, loaded, empty, trailVisible, interpolatedSelected, cursor } =
    useReplayStore();
  const selectedFlight = selected
    ? replayStore.statesAt(cursor).find((f) => f.icao24 === selected)
    : undefined;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    let viewportTimer: ReturnType<typeof setTimeout> | undefined;

    async function createMap() {
      const [
        maplibregl,
        { MapboxOverlay },
        { IconLayer, LineLayer, TextLayer, ScatterplotLayer },
      ] = await Promise.all([
        import("maplibre-gl"),
        import("@deck.gl/mapbox"),
        import("@deck.gl/layers"),
      ]);
      const { Map } = maplibregl;
      if (cancelled || !container) return;

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

      const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
      overlayRef.current = overlay;

      map.on("load", () => {
        if (cancelled) return;
        map.addControl(overlay as unknown as import("maplibre-gl").IControl);
        const initialBounds = boundsFromMap(map);
        onBounds(initialBounds);
        void loadAirports(map, initialBounds);
        startRenderLoop(IconLayer, LineLayer, TextLayer, ScatterplotLayer);
      });

      map.on("dragstart", () => {
        if (replayStore.getSnapshot().followed) replayStore.follow(null);
      });

      map.on("moveend", () => {
        if (viewportTimer) clearTimeout(viewportTimer);
        viewportTimer = setTimeout(() => {
          if (cancelled) return;
          const bounds = boundsFromMap(map);
          onBounds(bounds);
          void loadAirports(map, bounds);
        }, VIEWPORT_DEBOUNCE_MS);
      });

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container);
    }

    async function loadAirports(
      map: import("maplibre-gl").Map,
      bounds: BoundingBox,
    ): Promise<void> {
      if (map.getZoom() < AIRPORT_MIN_ZOOM) {
        airportsRef.current = [];
        return;
      }
      try {
        const { airports } = await fetchAirports({
          bbox: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
          limit: 120,
        });
        if (!cancelled) airportsRef.current = airports;
      } catch {
        // airport overlay is supplementary
      }
    }

    function startRenderLoop(
      IconLayer: typeof import("@deck.gl/layers").IconLayer,
      LineLayer: typeof import("@deck.gl/layers").LineLayer,
      TextLayer: typeof import("@deck.gl/layers").TextLayer,
      ScatterplotLayer: typeof import("@deck.gl/layers").ScatterplotLayer,
    ) {
      const tick = (now: number) => {
        if (cancelled) return;
        const last = lastFrameRef.current;
        lastFrameRef.current = now;
        if (last != null) replayStore.advance(now - last);
        renderFrame(IconLayer, LineLayer, TextLayer, ScatterplotLayer);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    function renderFrame(
      IconLayer: typeof import("@deck.gl/layers").IconLayer,
      LineLayer: typeof import("@deck.gl/layers").LineLayer,
      TextLayer: typeof import("@deck.gl/layers").TextLayer,
      ScatterplotLayer: typeof import("@deck.gl/layers").ScatterplotLayer,
    ) {
      const overlay = overlayRef.current;
      const map = mapRef.current;
      if (!overlay || !map) return;

      const snap = replayStore.getSnapshot();
      const aircraft = snap.loaded && !snap.empty ? replayStore.statesAt(snap.cursor) : [];
      const visible = applyFilters(aircraft, filtersRef.current);
      const { selected: sel, followed: fol, hovered, trailVisible: trailsOn } = snap;

      type RenderPoint = {
        flight: FlightState;
        position: [number, number];
        confidence: number;
        stale: boolean;
      };

      const zoom = map.getZoom();
      const baseSize = iconSizeForZoom(zoom);
      const clock = snap.cursor || Date.now();

      const points: RenderPoint[] = visible.map((flight) => {
        const ageS = dataAgeSeconds(flight.lastSeen, clock);
        return {
          flight,
          position: [flight.longitude, flight.latitude],
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
        getSize: (d) =>
          d.flight.icao24 === sel || d.flight.icao24 === fol ? baseSize + 8 : baseSize,
        getAngle: (d) => 360 - (d.flight.heading ?? 0),
        getColor: (d) => {
          const alpha = Math.round(
            255 * (d.flight.onGround ? 0.55 : 1) * (d.stale ? 0.6 : 1) * Math.max(0.35, d.confidence),
          );
          if (d.flight.icao24 === sel || d.flight.icao24 === fol) {
            return [...COLOR_SELECTED, alpha];
          }
          if (d.flight.icao24 === hovered) return [...COLOR_HOVER, alpha];
          if (d.stale) return [...COLOR_STALE, alpha];
          return [...(d.flight.onGround ? COLOR_GROUND : COLOR_DEFAULT), alpha];
        },
        updateTriggers: {
          getColor: [sel, fol, hovered],
          getSize: [sel, fol, baseSize],
        },
        onClick: (info) => {
          const flight = (info.object as RenderPoint | null)?.flight;
          replayStore.select(flight?.icao24 ?? null);
        },
        onHover: (info) => {
          const icao24 = (info.object as RenderPoint | null)?.flight.icao24 ?? null;
          if (hoveredRef.current !== icao24) {
            hoveredRef.current = icao24;
            replayStore.hover(icao24);
          }
        },
      });

      const layers: import("@deck.gl/core").Layer[] = [];

      const airports = zoom >= AIRPORT_MIN_ZOOM ? airportsRef.current : [];
      if (airports.length > 0) {
        layers.push(
          new ScatterplotLayer<Airport>({
            id: "airports",
            data: airports,
            pickable: false,
            getPosition: (a) => [a.longitude, a.latitude],
            getRadius: (a) => (a.type === "large_airport" ? 6 : 4.5),
            radiusUnits: "pixels",
            radiusMinPixels: 5,
            stroked: true,
            filled: true,
            getFillColor: [...COLOR_AIRPORT, 30],
            getLineWidth: 1.5,
            lineWidthUnits: "pixels",
            getLineColor: [...COLOR_AIRPORT, 190],
          }),
        );
      }

      layers.push(iconLayer);

      const labelsVisible = zoom >= LABEL_MIN_ZOOM && points.length <= LABEL_MAX_VISIBLE;
      if (labelsVisible) {
        const closeView = zoom >= 9;
        const labelled = points.filter((d) => d.flight.callsign || closeView);
        layers.push(
          new TextLayer<RenderPoint>({
            id: "aircraft-labels",
            data: labelled,
            pickable: false,
            getPosition: (d) => d.position,
            getText: (d) => {
              const callsign = d.flight.callsign ?? d.flight.icao24.toUpperCase();
              if (!closeView) return callsign;
              const altitude =
                d.flight.altitude != null
                  ? `${Math.round(d.flight.altitude * 3.28084).toLocaleString()} ft`
                  : "—";
              return `${callsign}\n${altitude}`;
            },
            getSize: 11,
            sizeUnits: "pixels",
            getColor: (d) =>
              d.flight.icao24 === sel || d.flight.icao24 === fol
                ? [...COLOR_SELECTED, 255]
                : [...COLOR_LABEL, 190],
            getPixelOffset: [0, -(baseSize / 2 + 9)],
            getTextAnchor: "middle",
            getAlignmentBaseline: "bottom",
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
            fontWeight: 500,
            characterSet: "auto",
            outlineWidth: 2,
            outlineColor: [7, 9, 13, 220],
            fontSettings: { sdf: true },
            updateTriggers: {
              getText: [closeView],
              getColor: [sel, fol],
              getPixelOffset: [baseSize],
            },
          }),
        );
      }

      const trailId = trailsOn ? (sel ?? fol) : null;
      if (trailId) {
        const trail = replayStore.getTrail(trailId);
        if (trail.length > 1) {
          const segments = trail.slice(1).map((point, i) => ({
            source: [trail[i].longitude, trail[i].latitude] as [number, number],
            target: [point.longitude, point.latitude] as [number, number],
            age: i / trail.length,
          }));
          layers.splice(
            layers.indexOf(iconLayer),
            0,
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

      if (fol) {
        const followedPoint = points.find((p) => p.flight.icao24 === fol);
        const now = performance.now();
        if (followedPoint && now - lastFollowMoveRef.current > FOLLOW_MIN_INTERVAL_MS) {
          const centre = map.getCenter();
          const offsetPx = Math.hypot(
            map.project(followedPoint.position).x - map.project(centre).x,
            map.project(followedPoint.position).y - map.project(centre).y,
          );
          if (offsetPx > FOLLOW_RECENTRE_PX) {
            lastFollowMoveRef.current = now;
            map.easeTo({
              center: followedPoint.position,
              duration: FOLLOW_EASE_MS,
              essential: true,
            });
          }
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
    // onBounds is stable enough for mount; HistoryView holds it in a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {loaded && !empty ? (
        <ReplayBanner />
      ) : null}

      <div className="absolute left-3 top-[21rem] z-[var(--z-controls)]">
        <FilterBar filters={filters} onChange={setFilters} />
      </div>

      <div className="absolute right-3 top-3 z-[var(--z-controls)]">
        <button
          type="button"
          onClick={toggleProjection}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] shadow-[var(--shadow-panel)] transition-colors hover:text-[var(--color-text)]"
          aria-pressed={is3D}
        >
          {is3D ? "3D" : "2D"}
        </button>
      </div>

      {selected && selectedFlight && loaded ? (
        <div className="absolute bottom-20 right-3 z-[var(--z-panels)] w-[320px] max-w-[calc(100vw-1.5rem)]">
          <AircraftPanel
            icao24={selected}
            flight={selectedFlight}
            clockMs={cursor}
            interpolated={interpolatedSelected}
            isFollowed={followed === selected}
            trailVisible={trailVisible}
            hideAlerts
            onClose={() => replayStore.select(null)}
            onFollow={() => replayStore.follow(followed === selected ? null : selected)}
            onToggleTrail={() => replayStore.toggleTrail()}
            onRecenter={(lon, lat) => flyTo(lon, lat)}
          />
        </div>
      ) : null}
    </div>
  );
}

function ReplayBanner() {
  const stampRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const snap = replayStore.getSnapshot();
      if (stampRef.current && snap.loaded) {
        stampRef.current.textContent = formatReplayTimestamp(snap.cursor);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      role="status"
      className="pointer-events-none absolute left-1/2 top-3 z-[var(--z-critical)] -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-center shadow-[var(--shadow-panel)]"
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--color-accent)]">
        Replay
      </div>
      <div
        ref={stampRef}
        className="tabular-nums text-[13px] text-[var(--color-text)]"
      />
    </div>
  );
}
