"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import type { AircraftCategory } from "@aethera/types";
import { CATEGORY_LABEL, SPOTTER_CATEGORIES } from "@aethera/flight-engine";
import { CATEGORY_COLOR, COLOR_RARE } from "@/lib/map-style";

export interface SpotterStyle {
  categoryColors: boolean;
  highlightRare: boolean;
  emphasized: AircraftCategory[];
}

export const defaultSpotterStyle: SpotterStyle = {
  categoryColors: false,
  highlightRare: false,
  emphasized: [],
};

function rgbCss(rgb: readonly [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function SpotterControls({
  style,
  onChange,
}: {
  style: SpotterStyle;
  onChange: (style: SpotterStyle) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = style.categoryColors || style.highlightRare;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-pressed={active}
        title="Spotter layer — category colours and rare types, off by default"
        className={`flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] shadow-[var(--shadow-panel)] transition-colors ${
          active ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        }`}
      >
        <Eye size={13} strokeWidth={1.6} />
        Spotter
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] w-56 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-[11px] shadow-[var(--shadow-panel)]">
          <label className="flex items-center justify-between text-[var(--color-text-muted)]">
            <span>Category colours</span>
            <input
              type="checkbox"
              checked={style.categoryColors}
              onChange={(e) =>
                onChange({
                  ...style,
                  categoryColors: e.target.checked,
                  emphasized: e.target.checked ? style.emphasized : [],
                })
              }
            />
          </label>
          <label className="mt-2 flex items-center justify-between text-[var(--color-text-muted)]">
            <span>Highlight rare types</span>
            <input
              type="checkbox"
              checked={style.highlightRare}
              onChange={(e) => onChange({ ...style, highlightRare: e.target.checked })}
            />
          </label>
          <p className="mt-2 text-[10px] text-[var(--color-text-subtle)]">
            Derived from registry typecodes. All traffic stays visible.
          </p>
        </div>
      )}
    </div>
  );
}

export function SpotterLegend({
  style,
  onChange,
}: {
  style: SpotterStyle;
  onChange: (style: SpotterStyle) => void;
}) {
  if (!style.categoryColors && !style.highlightRare) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 shadow-[var(--shadow-panel)]"
      role="group"
      aria-label="Spotter legend"
    >
      {style.categoryColors
        ? SPOTTER_CATEGORIES.map((id) => {
            const on = style.emphasized.length === 0 || style.emphasized.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const selected = style.emphasized.includes(id)
                    ? style.emphasized.filter((value) => value !== id)
                    : [...style.emphasized, id];
                  onChange({ ...style, emphasized: selected });
                }}
                aria-pressed={style.emphasized.includes(id)}
                title={
                  style.emphasized.length === 0
                    ? `Emphasise ${CATEGORY_LABEL[id]} — others stay visible, dimmed`
                    : CATEGORY_LABEL[id]
                }
                className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] transition-opacity"
                style={{
                  color: rgbCss(CATEGORY_COLOR[id]),
                  opacity: on ? 1 : 0.35,
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: rgbCss(CATEGORY_COLOR[id]) }}
                  aria-hidden
                />
                {CATEGORY_LABEL[id]}
              </button>
            );
          })
        : null}
      {style.highlightRare ? (
        <span
          className="flex items-center gap-1.5 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em]"
          style={{ color: rgbCss(COLOR_RARE) }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: rgbCss(COLOR_RARE) }}
            aria-hidden
          />
          Rare
        </span>
      ) : null}
    </div>
  );
}
