import type { AircraftCategory } from "@aethera/types";

/**
 * Spotter classification and identity matching.
 *
 * Category and rarity are derived from ICAO type designators in the Phase 2
 * registry, never from live ADS-B. A missing typecode is unknown, not a
 * classification. Rarity is a curated flag, not a statistical claim about
 * how many of that type are flying today.
 */

export const SPOTTER_CATEGORIES: readonly AircraftCategory[] = [
  "widebody",
  "turboprop",
  "military",
  "ga",
] as const;

export const CATEGORY_LABEL: Record<AircraftCategory, string> = {
  widebody: "Widebody",
  turboprop: "Turboprop",
  military: "Military",
  ga: "GA",
  narrowbody: "Narrowbody",
  unknown: "Unknown",
};

/** ICAO type designators treated as uncommon enough to flag for spotters. */
const RARE_TYPES = new Set([
  // Spec examples
  "MD11",
  "B742",
  "CONC",
  "A388",
  "AN12",
  "IL76",
  // Same families / equally scarce airframes
  "DC10",
  "L101",
  "B741",
  "B743",
  "B74S",
  "A124",
  "A225",
  "AN22",
  "AN24",
  "AN26",
  "IL62",
  "IL86",
  "IL96",
  "T134",
  "T154",
  "C5M",
  "B52",
  "B1",
  "B2",
]);

const WIDEBODY = new Set([
  "A306",
  "A30B",
  "A310",
  "A332",
  "A333",
  "A338",
  "A339",
  "A342",
  "A343",
  "A345",
  "A346",
  "A359",
  "A35K",
  "A388",
  "B741",
  "B742",
  "B743",
  "B744",
  "B748",
  "B74S",
  "B74R",
  "B74D",
  "B762",
  "B763",
  "B764",
  "B772",
  "B773",
  "B77L",
  "B77W",
  "B778",
  "B779",
  "B788",
  "B789",
  "B78X",
  "MD11",
  "DC10",
  "L101",
  "IL86",
  "IL96",
  "A124",
  "A225",
]);

const NARROWBODY = new Set([
  "A318",
  "A319",
  "A19N",
  "A320",
  "A20N",
  "A321",
  "A21N",
  "B731",
  "B732",
  "B733",
  "B734",
  "B735",
  "B736",
  "B737",
  "B738",
  "B739",
  "B37M",
  "B38M",
  "B39M",
  "B3XM",
  "BCS1",
  "BCS3",
  "B712",
  "E170",
  "E75L",
  "E75S",
  "E190",
  "E195",
  "E290",
  "E295",
  "E135",
  "E145",
  "E45X",
  "CRJ1",
  "CRJ2",
  "CRJ7",
  "CRJ9",
  "CRJX",
  "B461",
  "B462",
  "B463",
  "RJ70",
  "RJ85",
  "RJ1H",
  "F70",
  "F100",
  "DC91",
  "DC93",
  "DC94",
  "DC95",
  "MD80",
  "MD81",
  "MD82",
  "MD83",
  "MD87",
  "MD88",
  "MD90",
  "SU95",
  "A148",
  "A158",
  "T204",
  "YK42",
]);

const TURBOPROP = new Set([
  "AT43",
  "AT45",
  "AT46",
  "AT72",
  "AT73",
  "AT75",
  "AT76",
  "DH8A",
  "DH8B",
  "DH8C",
  "DH8D",
  "D228",
  "D328",
  "DHC6",
  "DHC7",
  "SF34",
  "SB20",
  "JS31",
  "JS32",
  "JS41",
  "J328",
  "F27",
  "F50",
  "F60",
  "BE20",
  "BE30",
  "B350",
  "B190",
  "C208",
  "C408",
  "C212",
  "C295",
  "CN35",
  "PC12",
  "PC6",
  "TBM7",
  "TBM8",
  "TBM9",
  "TBM10",
  "AN12",
  "AN24",
  "AN26",
  "AN32",
  "AN72",
  "AN74",
  "SW4",
  "AC90",
  "AC95",
  "PAY2",
  "PAY3",
  "PAY4",
  "L410",
  "BN2P",
  "BN2T",
  "IL18",
  "KODI",
]);

const MILITARY = new Set([
  "C17",
  "C5M",
  "C130",
  "C30J",
  "C27J",
  "C2",
  "A400",
  "K35R",
  "K35E",
  "KC10",
  "KC46",
  "C135",
  "E3CF",
  "E3TF",
  "E6",
  "E8",
  "E4",
  "E7",
  "P8",
  "P3",
  "B52",
  "B1",
  "B2",
  "F16",
  "F15",
  "F18",
  "F22",
  "F35",
  "A10",
  "TYP",
  "EUFI",
  "JAS39",
  "M346",
  "V22",
  "H47",
  "H60",
  "H64",
  "AH64",
  "UH60",
  "CH47",
  "MQ9",
  "MQ1",
  "Q9",
  "Q4",
  "CONC",
  "U2",
  "SR71",
  "R135",
  "IL78",
]);

const GA = new Set([
  "C152",
  "C162",
  "C172",
  "C177",
  "C182",
  "C185",
  "C206",
  "C207",
  "C210",
  "C310",
  "C337",
  "C340",
  "C414",
  "C421",
  "T206",
  "T210",
  "P28A",
  "P28B",
  "P28R",
  "P28T",
  "P32R",
  "PA27",
  "PA30",
  "PA31",
  "PA32",
  "PA34",
  "PA44",
  "PA46",
  "P46T",
  "SR20",
  "SR22",
  "S22T",
  "BE33",
  "BE35",
  "BE36",
  "BE55",
  "BE58",
  "BE76",
  "BE9L",
  "M20P",
  "M20T",
  "M20U",
  "M20R",
  "DA20",
  "DA40",
  "DA42",
  "DA62",
  "RV6",
  "RV7",
  "RV8",
  "RV9",
  "RV10",
  "RV12",
  "RV14",
  "GLAS",
  "COL3",
  "COL4",
  "C77R",
  "TB20",
  "TB21",
  "TOBA",
  "DR40",
  "AA5",
  "AA5B",
  "E300",
  "R22",
  "R44",
  "R66",
  "B06",
  "B206",
  "B407",
  "EC20",
  "EC35",
  "AS50",
  "GLID",
  "ULAC",
  "GYRO",
]);

const MAX_PATTERN_LENGTH = 64;
/** A glob of only stars is cheap to reject and expensive to run. */
const MAX_WILDCARDS = 10;

export type IdentityPattern =
  | { kind: "all" }
  | { kind: "substring"; needle: string }
  | { kind: "regex"; regex: RegExp }
  | { kind: "invalid" };

export function normalizeTypeCode(typeCode: string | null | undefined): string | null {
  if (!typeCode) return null;
  const trimmed = typeCode.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function classifyTypeCode(typeCode: string | null | undefined): AircraftCategory {
  const code = normalizeTypeCode(typeCode);
  if (!code) return "unknown";
  // Dedicated military / special types outrank shared airframe families
  // (C130 is a turboprop, CONC is unique, A400 is both).
  if (MILITARY.has(code)) return "military";
  if (WIDEBODY.has(code)) return "widebody";
  if (TURBOPROP.has(code)) return "turboprop";
  if (GA.has(code)) return "ga";
  if (NARROWBODY.has(code)) return "narrowbody";
  return "unknown";
}

export function isRareType(typeCode: string | null | undefined): boolean {
  const code = normalizeTypeCode(typeCode);
  return code != null && RARE_TYPES.has(code);
}

/**
 * Parse a spotter identity query.
 *
 * - empty → match everything
 * - `TAP*` / `*834A` / `N12?` → glob, anchored, case-insensitive
 * - otherwise → case-insensitive substring over the supplied fields
 *
 * Freeform `/regex/` is not accepted. User-supplied RegExp against the live
 * snapshot is a ReDoS vector; glob covers the spotter cases.
 */
export function parseIdentityPattern(raw: string): IdentityPattern {
  const input = raw.trim();
  if (!input) return { kind: "all" };
  if (input.length > MAX_PATTERN_LENGTH) return { kind: "invalid" };

  if (input.includes("*") || input.includes("?")) {
    const wildcards = (input.match(/[*?]/g) ?? []).length;
    if (wildcards > MAX_WILDCARDS) return { kind: "invalid" };
    const escaped = input
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return { kind: "regex", regex: new RegExp(`^${escaped}$`, "i") };
  }

  return { kind: "substring", needle: input.toUpperCase() };
}

export function identityMatches(
  pattern: IdentityPattern,
  values: Array<string | null | undefined>,
): boolean {
  if (pattern.kind === "all") return true;
  if (pattern.kind === "invalid") return false;

  for (const value of values) {
    if (!value) continue;
    if (pattern.kind === "substring") {
      if (value.toUpperCase().includes(pattern.needle)) return true;
    } else if (pattern.regex.test(value)) {
      return true;
    }
  }
  return false;
}
