import type { AircraftCategory, AnomalySeverity } from "@aethera/types";

export const COLOR_DEFAULT: [number, number, number] = [139, 155, 176];
export const COLOR_GROUND: [number, number, number] = [93, 109, 130];
export const COLOR_HOVER: [number, number, number] = [232, 238, 246];
export const COLOR_SELECTED: [number, number, number] = [62, 224, 200];
export const COLOR_STALE: [number, number, number] = [93, 109, 130];
export const COLOR_LABEL: [number, number, number] = [200, 212, 226];
export const COLOR_AIRPORT: [number, number, number] = [120, 140, 165];
export const COLOR_RARE: [number, number, number] = [236, 214, 148];

export const CATEGORY_COLOR: Record<AircraftCategory, [number, number, number]> = {
  widebody: [62, 224, 200],
  turboprop: [224, 180, 74],
  military: [166, 138, 214],
  ga: [110, 122, 138],
  narrowbody: COLOR_DEFAULT,
  unknown: COLOR_DEFAULT,
};

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

export function aircraftFill(opts: {
  onGround: boolean;
  stale: boolean;
  confidence: number;
  selected: boolean;
  hovered: boolean;
  severity?: AnomalySeverity;
  category: AircraftCategory;
  rare: boolean;
  categoryColors: boolean;
  highlightRare: boolean;
  emphasized: readonly AircraftCategory[];
}): [number, number, number, number] {
  let alpha = Math.round(
    255 * (opts.onGround ? 0.55 : 1) * (opts.stale ? 0.6 : 1) * Math.max(0.35, opts.confidence),
  );

  if (opts.selected) return [COLOR_SELECTED[0], COLOR_SELECTED[1], COLOR_SELECTED[2], alpha];
  if (opts.hovered) return [COLOR_HOVER[0], COLOR_HOVER[1], COLOR_HOVER[2], alpha];
  if (opts.severity) {
    const color = SEVERITY_COLOR[opts.severity];
    return [color[0], color[1], color[2], Math.max(alpha, 200)];
  }
  if (opts.stale) return [COLOR_STALE[0], COLOR_STALE[1], COLOR_STALE[2], alpha];

  let rgb: [number, number, number] = opts.onGround ? COLOR_GROUND : COLOR_DEFAULT;
  if (opts.categoryColors) rgb = CATEGORY_COLOR[opts.category];
  if (opts.highlightRare && opts.rare && !opts.categoryColors) rgb = COLOR_RARE;

  const dimCategory =
    opts.categoryColors &&
    opts.emphasized.length > 0 &&
    !opts.emphasized.includes(opts.category);
  if (dimCategory && !(opts.highlightRare && opts.rare)) {
    alpha = Math.round(alpha * 0.28);
  }
  if (opts.highlightRare && !opts.rare) {
    alpha = Math.round(alpha * 0.45);
  }

  return [rgb[0], rgb[1], rgb[2], alpha];
}

export function aircraftSize(opts: {
  base: number;
  selected: boolean;
  alerted: boolean;
  rare: boolean;
  highlightRare: boolean;
}): number {
  if (opts.selected) return opts.base + 8;
  if (opts.highlightRare && opts.rare) return opts.base + 6;
  if (opts.alerted) return opts.base + 5;
  return opts.base;
}
