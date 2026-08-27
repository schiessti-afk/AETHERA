import type { BoundingBox, FlightDataProvider, FlightState, ProviderSnapshot } from "@aethera/types";
import { isValidLatitude, isValidLongitude } from "@aethera/validation";
import { OpenSkyAuth } from "./opensky-auth";
import { OpenSkyRateLimitError } from "./rate-limit-error";

const OPENSKY_URL = "https://opensky-network.org/api/states/all";

export type OpenSkyVector = [
  string,
  string | null,
  string | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  boolean | null,
  number | null,
  number | null,
  number | null,
  unknown,
  number | null,
  string | null,
  boolean | null,
  number | null,
];

interface OpenSkyResponse {
  time: number;
  states: OpenSkyVector[] | null;
}

export class OpenSkyProvider implements FlightDataProvider {
  readonly id = "opensky";
  private readonly auth: OpenSkyAuth;
  private lastQuotaRemaining: number | undefined;

  constructor(clientId: string, clientSecret: string) {
    this.auth = new OpenSkyAuth(clientId, clientSecret);
  }

  quotaRemaining(): number | undefined {
    return this.lastQuotaRemaining;
  }

  async getStates(bounds?: BoundingBox): Promise<FlightState[]> {
    const snapshot = await this.fetchSnapshot(bounds);
    return snapshot.states;
  }

  async fetchSnapshot(bounds?: BoundingBox): Promise<ProviderSnapshot> {
    return this.requestSnapshot(bounds, true);
  }

  private async requestSnapshot(
    bounds: BoundingBox | undefined,
    retryOnUnauthorized: boolean,
  ): Promise<ProviderSnapshot> {
    const url = new URL(OPENSKY_URL);
    if (bounds) {
      url.searchParams.set("lamin", String(bounds.south));
      url.searchParams.set("lomin", String(bounds.west));
      url.searchParams.set("lamax", String(bounds.north));
      url.searchParams.set("lomax", String(bounds.east));
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const token = await this.auth.getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });
    if (response.status === 401 && retryOnUnauthorized && this.auth.enabled) {
      this.auth.invalidate();
      return this.requestSnapshot(bounds, false);
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("x-rate-limit-retry-after-seconds") ?? 60);
      throw new OpenSkyRateLimitError(Number.isFinite(retryAfter) ? retryAfter : 60);
    }
    if (!response.ok) {
      throw new Error(`OpenSky request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as OpenSkyResponse;
    const receivedAt = new Date().toISOString();
    const sourceTime = new Date(payload.time * 1000).toISOString();
    const states = (payload.states ?? [])
      .map((vector) => normalizeVector(vector, receivedAt))
      .filter((state): state is FlightState => state !== null);
    const remainingHeader = response.headers.get("x-rate-limit-remaining");
    const remaining = remainingHeader != null ? Number(remainingHeader) : undefined;
    this.lastQuotaRemaining = Number.isFinite(remaining) ? remaining : undefined;

    return {
      states,
      sourceTime,
    };
  }
}

export function normalizeVector(vector: OpenSkyVector, receivedAt: string): FlightState | null {
  const icao24 = vector[0]?.trim();
  const longitude = vector[5];
  const latitude = vector[6];
  if (!icao24 || !isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    return null;
  }

  const lastContact = vector[4] ?? vector[3];
  const lastSeen = lastContact
    ? new Date(lastContact * 1000).toISOString()
    : receivedAt;

  const callsign = vector[1]?.trim();
  const heading = vector[10];

  return {
    icao24,
    callsign: callsign || undefined,
    originCountry: vector[2] ?? undefined,
    longitude,
    latitude,
    altitude: vector[7] ?? undefined,
    geoAltitude: vector[13] ?? undefined,
    velocity: vector[9] ?? undefined,
    heading: heading != null && heading >= 0 && heading <= 360 ? heading : undefined,
    verticalRate: vector[11] ?? undefined,
    squawk: vector[14] ?? undefined,
    onGround: Boolean(vector[8]),
    spi: vector[15] ?? undefined,
    lastSeen,
    receivedAt,
    processedAt: new Date().toISOString(),
  };
}
