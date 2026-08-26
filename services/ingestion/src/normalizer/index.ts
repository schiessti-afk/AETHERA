import type { FlightState } from "@aethera/types";
import { flightStateSchema } from "@aethera/validation";

export function validateStates(states: FlightState[]): FlightState[] {
  const valid: FlightState[] = [];
  for (const state of states) {
    const parsed = flightStateSchema.safeParse(state);
    if (parsed.success) {
      valid.push(parsed.data);
    }
  }
  return valid;
}
