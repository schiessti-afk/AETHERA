"use client";

import { useEffect, useSyncExternalStore } from "react";
import { flightStore, type FlightStoreSnapshot } from "@/lib/flight-store";

export function useFlightStore(): FlightStoreSnapshot {
  return useSyncExternalStore(
    flightStore.subscribe,
    flightStore.getSnapshot,
    flightStore.getSnapshot,
  );
}

/** Owns the connection lifecycle for whichever component mounts it first (the map). */
export function useFlightConnection(): void {
  useEffect(() => {
    flightStore.connect();
    return () => flightStore.disconnect();
  }, []);
}
