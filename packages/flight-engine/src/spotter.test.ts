import { describe, expect, it } from "vitest";
import {
  classifyTypeCode,
  identityMatches,
  isRareType,
  parseIdentityPattern,
} from "./spotter";

describe("classifyTypeCode", () => {
  it("returns unknown when metadata is missing", () => {
    expect(classifyTypeCode(null)).toBe("unknown");
    expect(classifyTypeCode(undefined)).toBe("unknown");
    expect(classifyTypeCode("")).toBe("unknown");
    expect(classifyTypeCode("   ")).toBe("unknown");
  });

  it("classifies the spec examples", () => {
    expect(classifyTypeCode("MD11")).toBe("widebody");
    expect(classifyTypeCode("B742")).toBe("widebody");
    expect(classifyTypeCode("A388")).toBe("widebody");
    expect(classifyTypeCode("AN12")).toBe("turboprop");
    expect(classifyTypeCode("CONC")).toBe("military");
    expect(classifyTypeCode("IL76")).toBe("unknown");
  });

  it("normalises case and padding", () => {
    expect(classifyTypeCode(" a388 ")).toBe("widebody");
    expect(classifyTypeCode("at72")).toBe("turboprop");
  });

  it("lets military types outrank shared airframe families", () => {
    expect(classifyTypeCode("C130")).toBe("military");
    expect(classifyTypeCode("A400")).toBe("military");
  });

  it("classifies everyday traffic without claiming rarity", () => {
    expect(classifyTypeCode("B738")).toBe("narrowbody");
    expect(classifyTypeCode("A20N")).toBe("narrowbody");
    expect(classifyTypeCode("AT72")).toBe("turboprop");
    expect(classifyTypeCode("C172")).toBe("ga");
    expect(classifyTypeCode("ZZZZ")).toBe("unknown");
  });
});

describe("isRareType", () => {
  it("flags the curated typecodes and nothing else", () => {
    expect(isRareType("MD11")).toBe(true);
    expect(isRareType("B742")).toBe(true);
    expect(isRareType("CONC")).toBe(true);
    expect(isRareType("A388")).toBe(true);
    expect(isRareType("AN12")).toBe(true);
    expect(isRareType("IL76")).toBe(true);
    expect(isRareType("B738")).toBe(false);
    expect(isRareType("B744")).toBe(false);
    expect(isRareType(null)).toBe(false);
  });
});

describe("parseIdentityPattern / identityMatches", () => {
  it("matches everything when the query is empty", () => {
    const pattern = parseIdentityPattern("  ");
    expect(pattern.kind).toBe("all");
    expect(identityMatches(pattern, ["BAW12"])).toBe(true);
    expect(identityMatches(pattern, [])).toBe(true);
  });

  it("uses case-insensitive substring when there are no wildcards", () => {
    const pattern = parseIdentityPattern("baw");
    expect(identityMatches(pattern, ["BAW12W"])).toBe(true);
    expect(identityMatches(pattern, ["RYR1"])).toBe(false);
    expect(identityMatches(pattern, [null, "3c65aa"])).toBe(false);
  });

  it("treats * and ? as anchored globs", () => {
    expect(identityMatches(parseIdentityPattern("TAP*"), ["TAP123"])).toBe(true);
    expect(identityMatches(parseIdentityPattern("TAP*"), ["ATAP"])).toBe(false);
    expect(identityMatches(parseIdentityPattern("*834A"), ["RCH834A"])).toBe(true);
    expect(identityMatches(parseIdentityPattern("*834A"), ["834A1"])).toBe(false);
    expect(identityMatches(parseIdentityPattern("N12*"), ["N12345"])).toBe(true);
    expect(identityMatches(parseIdentityPattern("N?2AB"), ["N12AB"])).toBe(true);
    expect(identityMatches(parseIdentityPattern("N?2AB"), ["N122AB"])).toBe(false);
  });

  it("compiles /regex/ against callsign, icao24, or registration", () => {
    const pattern = parseIdentityPattern("/^BAW\\d+$/");
    expect(identityMatches(pattern, ["BAW123"])).toBe(true);
    expect(identityMatches(pattern, ["BAW12W"])).toBe(false);
    expect(identityMatches(pattern, [null, "G-GHEA", "BAW1"])).toBe(true);
  });

  it("rejects broken regex and overlong patterns", () => {
    expect(parseIdentityPattern("/(/").kind).toBe("invalid");
    expect(parseIdentityPattern(`/${"a".repeat(80)}/`).kind).toBe("invalid");
    expect(identityMatches(parseIdentityPattern("/(/"), ["BAW123"])).toBe(false);
  });

  it("does not treat a single leading slash as regex", () => {
    const pattern = parseIdentityPattern("/BAW");
    expect(pattern.kind).toBe("substring");
    expect(identityMatches(pattern, ["/BAW12"])).toBe(true);
  });
});
