"use client";

import { useEffect, useState } from "react";
import { X, Locate, Route, Crosshair } from "lucide-react";
import type { AircraftMetadata, FlightState } from "@aethera/types";
import { fetchAircraftDetail } from "@/lib/api";
import { Panel } from "@aethera/ui";
import { classifyTypeCode, dataAgeSeconds, isRareType, CATEGORY_LABEL } from "@aethera/flight-engine";
import { flightStore } from "@/lib/flight-store";
import { useFlightStore } from "@/hooks/use-flight-store";
import {
  formatAltitude,
  formatHeading,
  formatOrDash,
  formatRelativeTime,
  formatSpeed,
  formatVerticalRate,
  UNAVAILABLE,
} from "@/lib/format";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div className="tabular-nums text-[15px] text-[var(--color-text)]">{value}</div>
    </div>
  );
}

export function AircraftPanel({
  icao24,
  isFollowed,
  onClose,
  onFollow,
  onRecenter,
  flight: flightProp,
  clockMs,
  interpolated = false,
  trailVisible: trailVisibleProp,
  onToggleTrail,
  hideAlerts = false,
}: {
  icao24: string;
  isFollowed: boolean;
  onClose: () => void;
  onFollow: () => void;
  onRecenter: (longitude: number, latitude: number) => void;
  flight?: FlightState;
  /** Clock used for last-contact age. Replay passes the playback cursor. */
  clockMs?: number;
  interpolated?: boolean;
  trailVisible?: boolean;
  onToggleTrail?: () => void;
  hideAlerts?: boolean;
}) {
  const live = useFlightStore();
  const flight = flightProp ?? live.aircraft.get(icao24);
  const trailVisible = trailVisibleProp ?? live.trailVisible;
  const [metadata, setMetadata] = useState<AircraftMetadata | null>(null);

  // Registry identity is fetched per selection and kept out of the live store: it is
  // reference data about the airframe, not part of the observed telemetry stream.
  useEffect(() => {
    let cancelled = false;
    setMetadata(null);
    fetchAircraftDetail(icao24)
      .then((detail) => {
        if (!cancelled) setMetadata(detail.metadata);
      })
      .catch(() => {
        if (!cancelled) setMetadata(null); // metadata is optional by design
      });
    return () => {
      cancelled = true;
    };
  }, [icao24]);
  // A selected aircraft renders in the selection colour, which masks its alert colour
  // on the map — so if something is open against it, the panel has to say so.
  const alertSeverity = hideAlerts ? undefined : live.alerted.get(icao24);

  if (!flight) {
    return (
      <Panel title="Aircraft" className="text-sm">
        <p className="text-[var(--color-text-muted)]">
          No longer observed. It may reappear, or has left coverage.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          Close
        </button>
      </Panel>
    );
  }

  const now = clockMs ?? Date.now();
  const ageS = dataAgeSeconds(flight.lastSeen, now);
  const status = flight.onGround ? "ON GROUND" : ageS > 180 ? "STALE" : "AIRBORNE";
  const typeCategory = classifyTypeCode(metadata?.typeCode);

  return (
    <Panel
      title={formatOrDash(flight.callsign)}
      action={
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <X size={16} />
        </button>
      }
      className="text-sm"
    >
      <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        <span>{status}</span>
        {!flight.onGround && (interpolated || (ageS > 2 && ageS <= 180)) ? (
          <span
            className="text-[var(--color-text-subtle)]"
            title="Position is estimated from stored observations, not a new report"
          >
            · position estimated
          </span>
        ) : null}
      </div>

      {alertSeverity ? (
        <div
          className={`mb-3 rounded-[var(--radius-sm)] border px-2 py-1.5 text-[11px] uppercase tracking-[0.14em] ${
            alertSeverity === "critical"
              ? "border-[var(--color-danger)] text-[var(--color-danger)]"
              : "border-[var(--color-alert)] text-[var(--color-alert)]"
          }`}
        >
          Detected condition active
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Altitude" value={formatAltitude(flight.altitude)} />
        <Field label="Speed" value={formatSpeed(flight.velocity)} />
        <Field label="Heading" value={formatHeading(flight.heading)} />
        <Field label="Vertical rate" value={formatVerticalRate(flight.verticalRate)} />
      </div>

      <div className="my-3 border-t border-[var(--color-border)]" />

      {metadata && (metadata.registration || metadata.typeCode || metadata.operator) ? (
        <div className="mb-3 grid grid-cols-2 gap-3 text-[13px]">
          <Field label="Registration" value={formatOrDash(metadata.registration)} />
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
              Type
            </div>
            <div className="flex items-baseline gap-2 tabular-nums text-[15px] text-[var(--color-text)]">
              <span>{formatOrDash(metadata.typeCode)}</span>
              {isRareType(metadata.typeCode) ? (
                <span
                  className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-warning)]"
                  title="Flagged typecode — uncommon ICAO designator, not a count of airframes"
                >
                  Rare
                </span>
              ) : null}
            </div>
            {typeCategory !== "unknown" && typeCategory !== "narrowbody" ? (
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                {CATEGORY_LABEL[typeCategory]}
              </div>
            ) : null}
          </div>
          {metadata.operator ? (
            <div className="col-span-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                Operator
              </div>
              <div className="truncate text-[13px] text-[var(--color-text)]">
                {metadata.operator}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 text-[13px]">
        <Field label="ICAO24" value={flight.icao24.toUpperCase()} />
        <Field label="Squawk" value={formatOrDash(flight.squawk)} />
        <Field label="Last contact" value={formatRelativeTime(flight.lastSeen, now)} />
        <Field
          label="Position"
          value={
            flight.latitude != null && flight.longitude != null
              ? `${flight.latitude.toFixed(2)}, ${flight.longitude.toFixed(2)}`
              : UNAVAILABLE
          }
        />
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onFollow}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors ${
            isFollowed
              ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          <Locate size={13} strokeWidth={1.6} />
          {isFollowed ? "Exit follow" : "Follow"}
        </button>
        <button
          type="button"
          onClick={() => (onToggleTrail ? onToggleTrail() : flightStore.toggleTrail())}
          className={`flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors ${
            trailVisible
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
          aria-pressed={trailVisible}
        >
          <Route size={13} strokeWidth={1.6} />
          Trail
        </button>
        <button
          type="button"
          onClick={() => onRecenter(flight.longitude, flight.latitude)}
          className="flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <Crosshair size={13} strokeWidth={1.6} />
        </button>
      </div>
    </Panel>
  );
}
