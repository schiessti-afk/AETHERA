/** Aviation-literate unit formatting per docs/PRODUCT_SPEC.md §38. */

const M_TO_FT = 3.28084;
const MPS_TO_KT = 1.94384;
const MPS_TO_FPM = 196.85;

export const UNAVAILABLE = "—";

export function formatAltitude(meters: number | undefined, unit: "ft" | "m" = "ft"): string {
  if (meters == null || !Number.isFinite(meters)) return UNAVAILABLE;
  if (unit === "m") return `${Math.round(meters).toLocaleString()} M`;
  return `${Math.round(meters * M_TO_FT).toLocaleString()} FT`;
}

export function formatSpeed(mps: number | undefined, unit: "kt" | "kmh" = "kt"): string {
  if (mps == null || !Number.isFinite(mps)) return UNAVAILABLE;
  if (unit === "kmh") return `${Math.round(mps * 3.6).toLocaleString()} KM/H`;
  return `${Math.round(mps * MPS_TO_KT).toLocaleString()} KT`;
}

export function formatVerticalRate(mps: number | undefined): string {
  if (mps == null || !Number.isFinite(mps)) return UNAVAILABLE;
  const fpm = Math.round(mps * MPS_TO_FPM);
  const sign = fpm > 0 ? "+" : "";
  return `${sign}${fpm.toLocaleString()} FPM`;
}

export function formatHeading(deg: number | undefined): string {
  if (deg == null || !Number.isFinite(deg)) return UNAVAILABLE;
  return `${Math.round(deg)}°`;
}

export function formatOrDash(value: string | undefined | null): string {
  return value && value.trim().length > 0 ? value : UNAVAILABLE;
}

export function formatRelativeTime(iso: string | undefined, now = Date.now()): string {
  if (!iso) return UNAVAILABLE;
  const ageS = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (!Number.isFinite(ageS)) return UNAVAILABLE;
  if (ageS < 60) return `${ageS} SEC AGO`;
  if (ageS < 3600) return `${Math.round(ageS / 60)} MIN AGO`;
  return `${Math.round(ageS / 3600)} HR AGO`;
}
