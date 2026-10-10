/** setTimeout behind a port, so loops and watchdogs run on a fake clock in tests. */
export interface Timer {
  set(run: () => void, ms: number): number;
  clear(handle: number): void;
}

/** The page's own timers. */
export const WINDOW_TIMER: Timer = {
  set: (run, ms) => window.setTimeout(run, ms),
  clear: (handle) => window.clearTimeout(handle),
};
