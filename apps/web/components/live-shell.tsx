"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { StatusBanner } from "@/components/status-banner";
import { useSystemStats } from "@/hooks/use-system-stats";

export function LiveShell({ children }: { children: ReactNode }) {
  const { stats, status, nextPollEtaMs, retry } = useSystemStats();
  return (
    <AppShell
      status={status}
      observed={stats.observed}
      airborne={stats.airborne}
      nextPollEtaMs={nextPollEtaMs}
    >
      <StatusBanner status={status} lastError={stats.lastError} onRetry={retry} />
      {children}
    </AppShell>
  );
}
