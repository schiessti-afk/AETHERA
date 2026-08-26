"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBanner } from "@/components/status-banner";
import { useSystemStats } from "@/hooks/use-system-stats";
import { useFlightStore } from "@/hooks/use-flight-store";

export function LiveShell({ children }: { children: ReactNode }) {
  const { stats, status, nextPollEtaMs, retry } = useSystemStats();
  const { alerted } = useFlightStore();
  return (
    <AppShell
      status={status}
      observed={stats.observed}
      airborne={stats.airborne}
      alerts={alerted.size}
      nextPollEtaMs={nextPollEtaMs}
    >
      <StatusBanner status={status} lastError={stats.lastError} onRetry={retry} />
      {children}
    </AppShell>
  );
}
