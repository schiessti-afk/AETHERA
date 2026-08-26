import type { FlightState, SystemStats } from "@aethera/types";
import { apiUrl } from "./config";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`API ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchStats(): Promise<SystemStats> {
  return getJson<SystemStats>("/api/stats");
}

export function fetchAircraft(): Promise<{ aircraft: FlightState[]; count: number }> {
  return getJson("/api/aircraft");
}

export function search(q: string): Promise<{
  aircraft: FlightState[];
  airports: Array<{ icao: string; iata?: string; name: string }>;
}> {
  return getJson(`/api/search?q=${encodeURIComponent(q)}`);
}
