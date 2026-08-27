import { describe, expect, it } from "vitest";
import type { BoundingBox, FlightDataProvider, FlightState, ProviderSnapshot } from "@aethera/types";
import { Poller } from "./poller";
import { ProviderRateLimitError } from "../providers/rate-limit-error";

class FakeProvider implements FlightDataProvider {
  readonly id = "fake";
  snapshots: ProviderSnapshot[] = [];
  quota: number | undefined = 42;

  async fetchSnapshot(_bounds?: BoundingBox): Promise<ProviderSnapshot> {
    return this.snapshots.shift() ?? { states: [], sourceTime: new Date().toISOString() };
  }

  async getStates(bounds?: BoundingBox): Promise<FlightState[]> {
    return (await this.fetchSnapshot(bounds)).states;
  }

  quotaRemaining(): number | undefined {
    return this.quota;
  }
}

describe("Poller provider interface", () => {
  it("accepts a non-OpenSky FlightDataProvider", () => {
    const provider = new FakeProvider();
    const poller = new Poller(provider, {} as never, 90_000);
    expect(poller).toBeInstanceOf(Poller);
    expect(provider.id).toBe("fake");
  });

  it("treats ProviderRateLimitError as the generic backoff signal", () => {
    const error = new ProviderRateLimitError(30, "slow down");
    expect(error).toBeInstanceOf(Error);
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.name).toBe("ProviderRateLimitError");
  });
});
