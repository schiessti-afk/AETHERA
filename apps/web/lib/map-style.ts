import type { AnomalySeverity } from "@aethera/types";

export const COLOR_DEFAULT: [number, number, number] = [139, 155, 176];
export const COLOR_GROUND: [number, number, number] = [93, 109, 130];
export const COLOR_HOVER: [number, number, number] = [232, 238, 246];
export const COLOR_SELECTED: [number, number, number] = [62, 224, 200];
export const COLOR_STALE: [number, number, number] = [93, 109, 130];
export const COLOR_LABEL: [number, number, number] = [200, 212, 226];
export const COLOR_AIRPORT: [number, number, number] = [120, 140, 165];

export const SEVERITY_COLOR: Record<AnomalySeverity, [number, number, number]> = {
  critical: [224, 74, 74],
  high: [224, 122, 62],
  medium: [224, 180, 74],
  info: [139, 155, 176],
};

export const LABEL_MIN_ZOOM = 7;
export const LABEL_MAX_VISIBLE = 220;
export const AIRPORT_MIN_ZOOM = 6;

export function iconSizeForZoom(zoom: number): number {
  if (zoom < 4) return 11;
  if (zoom < 6) return 15;
  if (zoom < 8) return 19;
  return 22;
}

export function formatReplayTimestamp(ms: number): string {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}

export function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): number {
  return new Date(value).getTime();
}
