import { useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router';
import { HistoryLayers } from '../ui/HistoryLayers';
import { SheetHistory, type SheetState } from './SheetHistory';

export interface SheetNavigation {
  /** Pushes a sheet on top of the current one; back closes it again. */
  open(path: string): void;
  /** Swaps the current sheet for another, e.g. switching tabs, so back skips it. */
  swap(path: string): void;
  /**
   * Goes up to a section's first screen (a tab, "All areas"): back to it when it is underneath, so tapping a tab
   * inside its own section never stacks a copy; else in place of the current sheet; over the bare map, on top.
   */
  up(path: string): void;
  /** Closes the topmost sheet: back when it was opened in the app, else straight to `fallback`. */
  close(fallback?: string): void;
  /** Back to the map, unwinding every sheet. */
  home(): void;
  /** Router state for a <Link> that opens a sheet on top. */
  readonly linkState: SheetState;
}

// A second tap within this time on the same screen is the same request (a double tap on close, or a close
// fired by both the exit animation and its fallback timer); running it twice would pop two levels.
const REPEAT_MS = 600;

// Runs a sheet change once per screen: open layers (Filters, the stack list, the preview card) come off the
// stack first, so the next sheet replaces them instead of leaving them underneath.
function useOnce(key: string): (change: () => void) => void {
  const last = useRef({ key: '', at: 0 });
  return useCallback(
    (change: () => void) => {
      const now = performance.now();
      if (last.current.key === key && now - last.current.at < REPEAT_MS) return;
      last.current = { key, at: now };
      HistoryLayers.unwind(change);
    },
    [key],
  );
}

type Once = ReturnType<typeof useOnce>;

/**
 * The one model for sheets: each open sheet is one history level. Opening stacks one level (tabs swap), and
 * close, back, Escape, a drag down and a map tap each pop exactly one.
 */
export function useSheetNavigation(): SheetNavigation {
  const navigate = useNavigate();
  const { state, pathname, key } = useLocation();
  const once = useOnce(key);
  const { open, swap } = useStacking(navigate, once, state, pathname);
  const { close, home } = useUnstacking(navigate, once, SheetHistory.depth(state));
  const up = useCallback(
    (path: string) => {
      const steps = path === pathname ? 0 : SheetHistory.stepsTo(state, path);
      if (pathname === '/') open(path);
      else if (steps > 0) once(() => void navigate(-steps));
      else swap(path);
    },
    [pathname, state, open, swap, once, navigate],
  );
  const linkState = useMemo(() => SheetHistory.over(state, pathname), [state, pathname]);
  return useMemo(() => ({ open, swap, up, close, home, linkState }), [open, swap, up, close, home, linkState]);
}

// Open records the path it leaves (for `up`); swap keeps the entries below.
function useStacking(navigate: NavigateFunction, once: Once, state: unknown, pathname: string) {
  const open = useCallback(
    (path: string) => once(() => void navigate(path, { state: SheetHistory.over(state, pathname) })),
    [once, navigate, state, pathname],
  );
  const swap = useCallback(
    (path: string) => once(() => void navigate(path, { replace: true, state: SheetHistory.replacing(state) })),
    [once, navigate, state],
  );
  return { open, swap };
}

function useUnstacking(navigate: NavigateFunction, once: Once, depth: number) {
  const close = useCallback(
    (fallback = '/') => once(() => void (depth > 0 ? navigate(-1) : navigate(fallback, { replace: true }))),
    [once, navigate, depth],
  );
  const home = useCallback(() => once(() => void (depth > 0 ? navigate(-depth) : navigate('/', { replace: true }))), [once, navigate, depth]);
  return { close, home };
}
