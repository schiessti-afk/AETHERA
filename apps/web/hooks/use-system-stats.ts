"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus, SystemStats } from "@aethera/types";
import { fetchStats } from "@/lib/api";

const empty: SystemStats = {
  observed: 0,
  airborne: 0,
  onGround: 0,
  lastUpdate: null,
};

export function useSystemStats(intervalMs = 5000) {
  const [stats, setStats] = useState<SystemStats>(empty);
  const [status, setStatus] = useState<ConnectionStatus>("CONNECTING");

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const next = await fetchStats();
        if (cancelled) return;
        setStats(next);
        if (!next.lastUpdate) {
          setStatus("DEGRADED");
          return;
        }
        const age = (Date.now() - Date.parse(next.lastUpdate)) / 1000;
        if (age < 150) setStatus("LIVE");
        else if (age < 360) setStatus("DELAYED");
        else setStatus("DEGRADED");
      } catch {
        if (!cancelled) setStatus("OFFLINE");
      }
    }

    void tick();
    const id = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { stats, status };
}
