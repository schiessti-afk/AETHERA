"use client";

import { useEffect, useSyncExternalStore } from "react";
import { replayStore, type ReplaySnapshot } from "@/lib/replay-store";

export function useReplayStore(): ReplaySnapshot {
  return useSyncExternalStore(replayStore.subscribe, replayStore.getSnapshot, replayStore.getSnapshot);
}
