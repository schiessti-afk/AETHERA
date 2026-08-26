import { describe, expect, it } from "vitest";
import { normalizeVector, type OpenSkyVector } from "./opensky";

const RECEIVED_AT = "2026-08-26T12:00:00.000Z";

/** A well-formed OpenSky vector, overridable per-field for individual tests. */
function vector(overrides: Partial<{ [K in keyof OpenSkyVector]: OpenSkyVector[K] }> = {}): OpenSkyVector {
  const base: OpenSkyVector = [
    "3c4a12",
    "DLH9LF  ",
    "Germany",
    1787750000,
    1787750000,
    2.3522,
    48.8566,
    10668,
    false,
    235,
    92,
    -2.1,
    null,
    10700,
    "2143",
    false,
    0,
  ];
  return Object.assign(base.slice() as OpenSkyVector, overrides);
}

describe("normalizeVector", () => {
  it("normalizes a well-formed vector, trimming callsign whitespace", () => {
    const result = normalizeVector(vector(), RECEIVED_AT);
    expect(result).not.toBeNull();
    expect(result?.icao24).toBe("3c4a12");
    expect(result?.callsign).toBe("DLH9LF");
    expect(result?.longitude).toBe(2.3522);
    expect(result?.latitude).toBe(48.8566);
    expect(result?.altitude).toBe(10668);
    expect(result?.onGround).toBe(false);
    expect(result?.squawk).toBe("2143");
    expect(result?.receivedAt).toBe(RECEIVED_AT);
  });

  it("rejects a vector with no icao24", () => {
    expect(normalizeVector(vector({ 0: "" as never }), RECEIVED_AT)).toBeNull();
  });

  it("rejects an out-of-range latitude", () => {
    expect(normalizeVector(vector({ 6: 91 }), RECEIVED_AT)).toBeNull();
  });

  it("rejects an out-of-range longitude", () => {
    expect(normalizeVector(vector({ 5: -181 }), RECEIVED_AT)).toBeNull();
  });

  it("treats an empty callsign as undefined rather than an empty string", () => {
    const result = normalizeVector(vector({ 1: "        " }), RECEIVED_AT);
    expect(result?.callsign).toBeUndefined();
  });

  it("falls back to receivedAt when the source gives no contact time", () => {
    const result = normalizeVector(vector({ 3: null, 4: null }), RECEIVED_AT);
    expect(result?.lastSeen).toBe(RECEIVED_AT);
  });

  it("prefers last_contact (index 4) over time_position (index 3) for lastSeen", () => {
    const result = normalizeVector(vector({ 3: 1787750000, 4: 1787750100 }), RECEIVED_AT);
    expect(result?.lastSeen).toBe(new Date(1787750100 * 1000).toISOString());
  });

  it("drops an out-of-range heading rather than passing it through", () => {
    const result = normalizeVector(vector({ 10: 361 }), RECEIVED_AT);
    expect(result?.heading).toBeUndefined();
  });

  it("keeps a heading of exactly 0 (north) rather than treating it as missing", () => {
    const result = normalizeVector(vector({ 10: 0 }), RECEIVED_AT);
    expect(result?.heading).toBe(0);
  });

  it("passes through onGround true for a taxiing aircraft with no altitude", () => {
    const result = normalizeVector(vector({ 7: null, 8: true }), RECEIVED_AT);
    expect(result?.onGround).toBe(true);
    expect(result?.altitude).toBeUndefined();
  });
});
