"use client";

import { useSyncExternalStore } from "react";
import { replayModeStore, type ReplayModeState } from "@/lib/replay-mode";

export function useReplayMode(): ReplayModeState {
  return useSyncExternalStore(
    replayModeStore.subscribe,
    replayModeStore.getSnapshot,
    replayModeStore.getSnapshot,
  );
}
