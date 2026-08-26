import type { FlightDataProvider, FlightState } from "@aethera/types";

export type { FlightDataProvider };

export interface ProviderSnapshot {
  states: FlightState[];
  sourceTime: string;
  creditsRemaining?: number;
}
