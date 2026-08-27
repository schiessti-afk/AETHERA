"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Building2,
  Clock3,
  Compass,
  Search,
} from "lucide-react";
import { StatusIndicator } from "@aethera/ui";
import type { ConnectionStatus } from "@aethera/types";
import type { ReactNode } from "react";
import { useReplayMode } from "@/hooks/use-replay-mode";

const nav = [
  { href: "/", label: "Explore", icon: Compass },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/airports", label: "Airports", icon: Building2 },
  { href: "/analytics", label: "Analytics", icon: Activity },
  { href: "/history", label: "History", icon: Clock3 },
];

function formatEta(ms: number | null): string | null {
  if (ms == null) return null;
  const seconds = Math.round(ms / 1000);
  if (seconds <= 0) return "next update any moment";
  if (seconds < 60) return `next update in ${seconds}s`;
  return `next update in ${Math.round(seconds / 60)}m`;
}

export function AppShell({
  children,
  status = "CONNECTING",
  observed = 0,
  airborne = 0,
  alerts = 0,
  climbing = 0,
  descending = 0,
  nextPollEtaMs = null,
}: {
  children: ReactNode;
  status?: ConnectionStatus;
  observed?: number;
  airborne?: number;
  alerts?: number;
  climbing?: number;
  descending?: number;
  nextPollEtaMs?: number | null;
}) {
  const pathname = usePathname();
  const replay = useReplayMode();
  const etaLabel =
    !replay.active && (status === "LIVE" || status === "DELAYED")
      ? formatEta(nextPollEtaMs)
      : null;
  const observedCount = replay.active ? replay.observed : observed;
  const airborneCount = replay.active ? replay.airborne : airborne;

  return (
    <div className="flex h-dvh flex-col bg-[var(--color-background)] text-[var(--color-text)]">
      <header className="z-[30] flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4">
        <div className="flex items-baseline gap-3">
          <Link href="/" className="text-sm font-semibold tracking-[0.28em]">
            AETHERA
          </Link>
          <span className="hidden text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] sm:inline">
            Live Airspace Intelligence
          </span>
        </div>
        <div className="flex items-center gap-4">
          {!replay.active ? (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent("aethera:open-search"))}
              className="hidden items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] md:flex"
              aria-label="Search aircraft or airport"
            >
              <Search size={14} />
              <span>Search</span>
              <kbd className="ml-4 text-[10px] text-[var(--color-text-subtle)]">⌘ K</kbd>
            </button>
          ) : (
            <Link
              href="/"
              className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent)] hover:underline"
            >
              Return to live
            </Link>
          )}
          {replay.active && replay.timestamp ? (
            <div
              className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-accent)]"
              role="status"
            >
              <span aria-hidden="true">●</span>
              <span>Replay</span>
              <span className="tabular-nums text-[var(--color-text)] normal-case tracking-normal">
                {replay.timestamp.slice(0, 10)} {replay.timestamp.slice(11, 19)} UTC
              </span>
            </div>
          ) : (
            <StatusIndicator status={status} />
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav
          className="hidden w-16 shrink-0 flex-col items-center gap-1 border-r border-[var(--color-border)] bg-[var(--color-surface)] py-3 md:flex"
          aria-label="Primary"
        >
          {nav.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex w-14 flex-col items-center gap-1 rounded-[var(--radius-md)] px-1 py-2 text-[10px] uppercase tracking-[0.12em] transition-colors duration-[var(--motion-fast)] ${
                  active
                    ? "bg-[var(--color-surface-selected)] text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                <Icon size={16} strokeWidth={1.6} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="relative min-w-0 flex-1">{children}</main>
      </div>

      <footer className="z-[30] flex h-10 shrink-0 items-center gap-6 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[11px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        <span>
          <strong className="mr-2 tabular-nums text-[var(--color-text)]">
            {observedCount.toLocaleString()}
          </strong>
          Observed
        </span>
        <span>
          <strong className="mr-2 tabular-nums text-[var(--color-text)]">
            {airborneCount.toLocaleString()}
          </strong>
          Airborne
        </span>
        {replay.active ? null : (
          <>
            <span className="hidden lg:inline">
              <strong className="mr-2 tabular-nums text-[var(--color-text)]">
                {climbing.toLocaleString()}
              </strong>
              Climbing
            </span>
            <span className="hidden lg:inline">
              <strong className="mr-2 tabular-nums text-[var(--color-text)]">
                {descending.toLocaleString()}
              </strong>
              Descending
            </span>
          </>
        )}
        {alerts > 0 && !replay.active ? (
          <Link href="/alerts" className="text-[var(--color-alert)] hover:underline">
            <strong className="mr-2 tabular-nums">{alerts.toLocaleString()}</strong>
            {alerts === 1 ? "Alert" : "Alerts"}
          </Link>
        ) : null}
        {etaLabel ? (
          <span className="hidden text-[var(--color-text-subtle)] normal-case tracking-normal sm:inline">
            {etaLabel}
          </span>
        ) : null}
        <nav className="ml-auto flex gap-3 md:hidden" aria-label="Mobile">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={pathname === item.href ? "text-[var(--color-accent)]" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
