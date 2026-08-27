"use client";

import { useEffect, useRef } from "react";
import type { RegistryEntry } from "@aethera/types";
import { fetchRegistry } from "@/lib/api";

const REFRESH_MS = 90_000;

/**
 * Live icao24 → typecode/registration, kept out of the telemetry store.
 * The render loop reads the ref every frame so a refresh does not need a
 * React re-render to recolour markers.
 */
export function useAircraftRegistry() {
  const ref = useRef<Map<string, RegistryEntry>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { index } = await fetchRegistry();
        if (!cancelled) ref.current = new Map(Object.entries(index));
      } catch {
        // Colouring is optional; live telemetry must not depend on it.
      }
    }

    void load();
    const id = setInterval(() => void load(), REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return ref;
}
