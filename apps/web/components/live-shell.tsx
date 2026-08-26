"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { useSystemStats } from "@/hooks/use-system-stats";

export function LiveShell({ children }: { children: ReactNode }) {
  const { stats, status } = useSystemStats();
  return (
    <AppShell status={status} observed={stats.observed} airborne={stats.airborne}>
      {children}
    </AppShell>
  );
}
