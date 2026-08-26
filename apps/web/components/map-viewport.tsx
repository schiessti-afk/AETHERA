"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnomalySeverity, BoundingBox, FlightState } from "@aethera/types";
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
const COLOR_LABEL: [number, number, number] = [200, 212, 226];

/** Design §8 alert hierarchy, matching the semantic tokens in packages/ui/src/styles.css. */
const SEVERITY_COLOR: Record<AnomalySeverity, [number, number, number]> = {
  critical: [224, 74, 74], // --color-danger
  high: [224, 122, 62], // --color-alert
  medium: [224, 180, 74], // --color-warning
  info: [139, 155, 176], // --color-text-muted
};

const VIEWPORT_DEBOUNCE_MS = 350;

/**
 * Icon size by zoom — PRODUCT_SPEC §10.4 requires information density to change with
 * zoom. At world view a global snapshot is ~12,000 aircraft, and drawing those at close-
 * view size turns Europe into a solid mass of overlapping glyphs where nothing (an alert
 * included) is findable. Shrinking the marker keeps every observed aircraft on screen —
 * they are never culled, which would misrepresent what was observed — while restoring
 * the shape of the traffic.
 */
function iconSizeForZoom(zoom: number): number {
  if (zoom < 4) return 11;
  if (zoom < 6) return 15;
  if (zoom < 8) return 19;
  return 22;
}

/** Below this zoom, callsign labels are never drawn: they cannot resolve. */
const LABEL_MIN_ZOOM = 7;
/**
 * Even when zoomed in, labels are suppressed while too many aircraft are in view.
 * §10.4: "when density is high, labels recede and selection/hover remains the path
 * to detail".
 */
const LABEL_MAX_VISIBLE = 220;

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
      const [maplibregl, { MapboxOverlay }, { IconLayer, LineLayer, TextLayer }] = await Promise.all([
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
        startRenderLoop(IconLayer, LineLayer, TextLayer);

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
          if (!cancelled) flightStore.setBounds(boundsFromMap(map));
        }, VIEWPORT_DEBOUNCE_MS);
      });

      resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(container);
    }

    function startRenderLoop(
      IconLayer: typeof import("@deck.gl/layers").IconLayer,
      LineLayer: typeof import("@deck.gl/layers").LineLayer,
      TextLayer: typeof import("@deck.gl/layers").TextLayer,
    ) {
      const tick = () => {
        if (cancelled) return;
        renderFrame(IconLayer, LineLayer, TextLayer);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    function renderFrame(
      IconLayer: typeof import("@deck.gl/layers").IconLayer,
      LineLayer: typeof import("@deck.gl/layers").LineLayer,
      TextLayer: typeof import("@deck.gl/layers").TextLayer,
    ) {
      const overlay = overlayRef.current;
      const map = mapRef.current;
      if (!overlay || !map) return;

      const now = Date.now();
      const { aircraft, selected, followed, hovered, trailVisible, alerted } =
        flightStore.getSnapshot();
      const visible = applyFilters(Array.from(aircraft.values()), filtersRef.current);

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
          if (d.flight.icao24 === selected || d.flight.icao24 === followed) {
            return baseSize + 8;
          }
          // Alerted aircraft get a modest size bump so they stay findable in dense
          // traffic without turning into the loudest thing on the map (Design §25).
          return alerted.has(d.flight.icao24) ? baseSize + 5 : baseSize;
        },
        // deck.gl IconLayer rotates counter-clockwise from the icon's own up axis; our
        // glyph is drawn north-up and `heading` is compass degrees, hence the negation.
        // Verified against live traffic: BAW60 (309°), RYR6DX (305°) and EXS64G (310°)
        // all render pointing north-west while UAE93P (114°) points south-east. A flipped
        // sign would have drawn those north-west aircraft at 51°, i.e. north-east.
        getAngle: (d) => 360 - (d.flight.heading ?? 0),
        getColor: (d) => {
          const alpha = Math.round(255 * (d.flight.onGround ? 0.55 : 1) * (d.stale ? 0.6 : 1) * Math.max(0.35, d.confidence));
          if (d.flight.icao24 === selected || d.flight.icao24 === followed) {
            return [...COLOR_SELECTED, alpha];
          }
          if (d.flight.icao24 === hovered) return [...COLOR_HOVER, alpha];
          // Alert state outranks stale/ground styling: an aircraft with something open
          // against it should not be visually demoted for also being quiet (§11.3).
          const severity = alerted.get(d.flight.icao24);
          if (severity) return [...SEVERITY_COLOR[severity], Math.max(alpha, 200)];
          if (d.stale) return [...COLOR_STALE, alpha];
          return [...(d.flight.onGround ? COLOR_GROUND : COLOR_DEFAULT), alpha];
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

      const layers: import("@deck.gl/core").Layer[] = [iconLayer];

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
