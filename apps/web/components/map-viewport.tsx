"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Airport, BoundingBox, FlightState } from "@aethera/types";
import { classifyTypeCode, dataAgeSeconds, interpolatePosition, isRareType, positionConfidence } from "@aethera/flight-engine";
import { mapStyleUrl } from "@/lib/config";
import { flightStore } from "@/lib/flight-store";
import { useFlightConnection, useFlightStore } from "@/hooks/use-flight-store";
import { useAircraftRegistry } from "@/hooks/use-aircraft-registry";
import { AIRCRAFT_ICON_ATLAS, AIRCRAFT_ICON_MAPPING } from "@/lib/aircraft-icon";
import {
  AIRPORT_MIN_ZOOM,
  COLOR_AIRPORT,
  COLOR_LABEL,
  COLOR_SELECTED,
  LABEL_MAX_VISIBLE,
  LABEL_MIN_ZOOM,
  aircraftFill,
  aircraftSize,
  iconSizeForZoom,
} from "@/lib/map-style";
import { AircraftPanel } from "@/components/aircraft-panel";
import { FilterBar, type Filters, defaultFilters, applyFilters } from "@/components/filter-bar";
import {
  SpotterControls,
  SpotterLegend,
  defaultSpotterStyle,
  type SpotterStyle,
} from "@/components/spotter-controls";
import { CommandPalette } from "@/components/command-palette";
import { fetchAirports } from "@/lib/api";
import { AirportPeek } from "@/components/airport-peek";

const VIEWPORT_DEBOUNCE_MS = 350;

/** Follow mode camera pacing — see the note at the follow block in renderFrame. */
const FOLLOW_MIN_INTERVAL_MS = 400;
const FOLLOW_EASE_MS = 600;
/** Only recentre once the aircraft has drifted this far off centre, in screen pixels. */
const FOLLOW_RECENTRE_PX = 60;

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
  const lastFollowMoveRef = useRef(0);
  const [is3D, setIs3D] = useState(true);
  const [spotter, setSpotter] = useState<SpotterStyle>(defaultSpotterStyle);
  const spotterRef = useRef(spotter);
  spotterRef.current = spotter;
  const registryRef = useAircraftRegistry();
  // Airports in view, fetched per viewport. Kept in a ref because the render loop reads
  // them every frame and they must not drive React re-renders.
  const airportsRef = useRef<Airport[]>([]);
  const [peeked, setPeeked] = useState<Airport | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useFlightConnection();
  const { selected, followed, followLost } = useFlightStore();

  // --- Map + deck.gl overlay setup -----------------------------------------
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
        const initialBounds = boundsFromMap(map);
        flightStore.setBounds(initialBounds);
        void loadAirports(map, initialBounds);
        startRenderLoop(IconLayer, LineLayer, TextLayer, ScatterplotLayer);

        // An alert clicked on the Alerts route parks a camera target before navigating
        // here; claim it once the map can actually move.
        const pending = flightStore.claimFlyTo();
        if (pending) {
          map.easeTo({
            center: [pending.longitude, pending.latitude],
            zoom: 9,
            duration: 900,
          });
        }
      });

      // Taking hold of the map is an unambiguous request to look somewhere else, so it
      // releases follow (§13: follow must never trap the user). `dragstart` only fires
      // for real pointer interaction — our own easeTo does not trigger it.
      map.on("dragstart", () => {
        if (flightStore.getSnapshot().followed) flightStore.follow(null);
      });

      map.on("moveend", () => {
        if (viewportTimer) clearTimeout(viewportTimer);
        viewportTimer = setTimeout(() => {
          if (cancelled) return;
          const bounds = boundsFromMap(map);
          flightStore.setBounds(bounds);
          void loadAirports(map, bounds);
        }, VIEWPORT_DEBOUNCE_MS);
      });

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container);
    }

    /**
     * Airports are only worth fetching for the visible area, and only once the view is
     * close enough for them to be secondary to aircraft rather than clutter (§19.3).
     */
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
        // An airport overlay is supplementary; the map still works without it.
      }
    }

    function startRenderLoop(
      IconLayer: typeof import("@deck.gl/layers").IconLayer,
      LineLayer: typeof import("@deck.gl/layers").LineLayer,
      TextLayer: typeof import("@deck.gl/layers").TextLayer,
      ScatterplotLayer: typeof import("@deck.gl/layers").ScatterplotLayer,
    ) {
      const tick = () => {
        if (cancelled) return;
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

      const now = Date.now();
      const { aircraft, selected, followed, hovered, trailVisible, alerted } =
        flightStore.getSnapshot();
      const visible = applyFilters(
        Array.from(aircraft.values()),
        filtersRef.current,
        registryRef.current,
      );
      const spotterStyle = spotterRef.current;

      type RenderPoint = {
        flight: FlightState;
        position: [number, number];
        confidence: number;
        stale: boolean;
      };

      const zoom = map.getZoom();
      const baseSize = iconSizeForZoom(zoom);

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
        getSize: (d) => {
          const typeCode = registryRef.current.get(d.flight.icao24)?.typeCode ?? null;
          return aircraftSize({
            base: baseSize,
            selected: d.flight.icao24 === selected || d.flight.icao24 === followed,
            alerted: alerted.has(d.flight.icao24),
            rare: isRareType(typeCode),
            highlightRare: spotterStyle.highlightRare,
          });
        },
        // deck.gl IconLayer rotates counter-clockwise from the icon's own up axis; our
        // glyph is drawn north-up and `heading` is compass degrees, hence the negation.
        // Verified against live traffic: BAW60 (309°), RYR6DX (305°) and EXS64G (310°)
        // all render pointing north-west while UAE93P (114°) points south-east. A flipped
        // sign would have drawn those north-west aircraft at 51°, i.e. north-east.
        getAngle: (d) => 360 - (d.flight.heading ?? 0),
        getColor: (d) => {
          const typeCode = registryRef.current.get(d.flight.icao24)?.typeCode ?? null;
          return aircraftFill({
            onGround: d.flight.onGround,
            stale: d.stale,
            confidence: d.confidence,
            selected: d.flight.icao24 === selected || d.flight.icao24 === followed,
            hovered: d.flight.icao24 === hovered,
            severity: alerted.get(d.flight.icao24),
            category: classifyTypeCode(typeCode),
            rare: isRareType(typeCode),
            categoryColors: spotterStyle.categoryColors,
            highlightRare: spotterStyle.highlightRare,
            emphasized: spotterStyle.emphasized,
          });
        },
        updateTriggers: {
          getColor: [selected, followed, hovered, alerted],
          getSize: [selected, followed, alerted, baseSize],
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

      const layers: import("@deck.gl/core").Layer[] = [];

      // Airports sit below the aircraft so they read as ground anchors rather than
      // competing with live traffic (§19.3).
      const airports = zoom >= AIRPORT_MIN_ZOOM ? airportsRef.current : [];
      if (airports.length > 0) {
        layers.push(
          new ScatterplotLayer<Airport>({
            id: "airports",
            data: airports,
            pickable: true,
            getPosition: (a) => [a.longitude, a.latitude],
            getRadius: (a) => (a.type === "large_airport" ? 6 : 4.5),
            radiusUnits: "pixels",
            // A ring alone is a 1.5px-wide click target, which is effectively
            // unclickable. The near-transparent fill keeps the marker reading as an
            // outline while making the whole disc pickable.
            radiusMinPixels: 5,
            stroked: true,
            filled: true,
            getFillColor: [...COLOR_AIRPORT, 30],
            getLineWidth: 1.5,
            lineWidthUnits: "pixels",
            getLineColor: [...COLOR_AIRPORT, 190],
            onClick: (info) => {
              const airport = info.object as Airport | null;
              if (airport) setPeeked(airport);
            },
          }),
        );

        if (zoom >= LABEL_MIN_ZOOM) {
          layers.push(
            new TextLayer<Airport>({
              id: "airport-labels",
              data: airports.filter((a) => a.type === "large_airport" || zoom >= 8.5),
              getPosition: (a) => [a.longitude, a.latitude],
              getText: (a) => a.iata ?? a.icao,
              getSize: 10,
              sizeUnits: "pixels",
              getColor: [...COLOR_AIRPORT, 210],
              getPixelOffset: [0, 11],
              getTextAnchor: "middle",
              getAlignmentBaseline: "top",
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              fontWeight: 500,
              characterSet: "auto",
              outlineWidth: 2,
              outlineColor: [7, 9, 13, 220],
              fontSettings: { sdf: true },
            }),
          );
        }
      }

      layers.push(iconLayer);

      // Callsign labels appear only once the view is close enough to read them and
      // sparse enough that they will not collide into noise (§10.4). Altitude joins
      // the label at close view, where there is room for it.
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
              d.flight.icao24 === selected || d.flight.icao24 === followed
                ? [...COLOR_SELECTED, 255]
                : [...COLOR_LABEL, 190],
            getPixelOffset: [0, -(baseSize / 2 + 9)],
            getTextAnchor: "middle",
            getAlignmentBaseline: "bottom",
            // A concrete stack, not var(--font-sans): deck.gl builds its glyph atlas with
            // canvas measureText, where a CSS custom property does not resolve and the
            // layer silently renders nothing.
            fontFamily: "Inter, system-ui, -apple-system, sans-serif",
            fontWeight: 500,
            characterSet: "auto",
            outlineWidth: 2,
            outlineColor: [7, 9, 13, 220],
            fontSettings: { sdf: true },
            updateTriggers: {
              getText: [closeView],
              getColor: [selected, followed],
              getPixelOffset: [baseSize],
            },
          }),
        );
      }

      const trailId = trailVisible ? (selected ?? followed) : null;
      if (trailId) {
        const trail = flightStore.getTrail(trailId);
        if (trail.length > 1) {
          const segments = trail.slice(1).map((point, i) => ({
            source: [trail[i].longitude, trail[i].latitude] as [number, number],
            target: [point.longitude, point.latitude] as [number, number],
            age: i / trail.length,
          }));
          // Sits below the aircraft: the trail belongs to a specific aircraft, so it
          // must not be drawn over the markers it relates to.
          const trailLayer = new LineLayer({
            id: "trail",
            data: segments,
            getSourcePosition: (d) => d.source,
            getTargetPosition: (d) => d.target,
            getColor: (d) => [...COLOR_SELECTED, Math.round(40 + 180 * d.age)],
            getWidth: 2,
            widthUnits: "pixels",
          });
          layers.splice(layers.indexOf(iconLayer), 0, trailLayer);
        }
      }

      overlay.setProps({ layers });

      // Follow mode. This used to jumpTo() on every animation frame, which pinned the
      // camera 60 times a second: the map could not be panned at all and the motion read
      // as a judder rather than a follow. Now the camera is only nudged when the aircraft
      // has drifted meaningfully off centre, and it eases rather than snaps.
      if (followed) {
        const followedPoint = points.find((p) => p.flight.icao24 === followed);
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

      {followLost ? (
        <div
          role="status"
          className="absolute left-1/2 top-3 z-[var(--z-panels)] -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] shadow-[var(--shadow-panel)]"
        >
          Contact lost with {followLost.icao24.toUpperCase()} · follow ended
          <button
            type="button"
            onClick={() => flightStore.clearFollowLost()}
            className="ml-3 text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
          >
            Dismiss
          </button>
        </div>
      ) : null}

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
        <SpotterControls style={spotter} onChange={setSpotter} />
      </div>

      {spotter.categoryColors || spotter.highlightRare ? (
        <div className="absolute bottom-3 left-1/2 z-[var(--z-controls)] -translate-x-1/2">
          <SpotterLegend style={spotter} onChange={setSpotter} />
        </div>
      ) : null}

      {peeked && !selected ? (
        <div className="absolute bottom-3 left-3 z-[var(--z-panels)]">
          <AirportPeek
            airport={peeked}
            onClose={() => setPeeked(null)}
            onFocus={(lon, lat) => flyTo(lon, lat)}
          />
        </div>
      ) : null}

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
