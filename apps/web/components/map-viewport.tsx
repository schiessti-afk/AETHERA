"use client";

import { useEffect, useRef } from "react";
import { mapStyleUrl } from "@/lib/config";

export function MapViewport() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;
    let resizeObserver: ResizeObserver | undefined;

    async function createMap() {
      const { Map } = await import("maplibre-gl");
      if (cancelled || !container) return;

      const instance = new Map({
        container,
        style: mapStyleUrl,
        center: [8, 48],
        zoom: 3.6,
        pitch: 42,
        bearing: -18,
        maxPitch: 80,
        attributionControl: { compact: true },
      });

      if (cancelled) {
        instance.remove();
        return;
      }

      map = instance;
      map.on("load", () => {
        map?.setProjection({ type: "globe" });
      });

      resizeObserver = new ResizeObserver(() => map?.resize());
      resizeObserver.observe(container);
    }

    void createMap();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      map?.remove();
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--color-background)]">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  );
}
