type Listener = () => void;

export interface ReplayModeState {
  active: boolean;
  timestamp: string | null;
  observed: number;
  airborne: number;
}

const empty: ReplayModeState = {
  active: false,
  timestamp: null,
  observed: 0,
  airborne: 0,
};

/**
 * Lets History publish REPLAY into the shell without lifting layout state.
 * Live Explore never writes here.
 */
class ReplayModeStore {
  private state: ReplayModeState = empty;
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): ReplayModeState => this.state;

  set(partial: Partial<ReplayModeState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener();
  }

  clear(): void {
    this.state = empty;
    for (const listener of this.listeners) listener();
  }
}

export const replayModeStore = new ReplayModeStore();
