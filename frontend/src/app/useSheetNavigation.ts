import { useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { HistoryLayers } from '../ui/HistoryLayers';
import { SheetHistory } from './SheetHistory';

export interface SheetNavigation {
  /** Pushes a sheet on top of the current one; back closes it again. */
  open(path: string): void;
  /** Swaps the current sheet for another, e.g. switching tabs, so back skips it. */
  swap(path: string): void;
  /** Closes the topmost sheet: back when it was opened in the app, else straight to `fallback`. */
  close(fallback?: string): void;
  /** Back to the map, unwinding every sheet. */
  home(): void;
  /** Router state for a <Link> that opens a sheet on top. */
  readonly linkState: { readonly depth: number };
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

/**
 * The one model for sheets: each open sheet is one history level. Opening stacks one level (tabs swap), and
 * close, back, Escape, a drag down and a map tap each pop exactly one.
 */
export function useSheetNavigation(): SheetNavigation {
  const navigate = useNavigate();
  const location = useLocation();
  const depth = SheetHistory.depth(location.state);
  const once = useOnce(location.key);
  const open = useCallback((path: string) => once(() => void navigate(path, { state: SheetHistory.above(depth) })), [once, navigate, depth]);
  const swap = useCallback(
    (path: string) => once(() => void navigate(path, { replace: true, state: SheetHistory.at(depth) })),
    [once, navigate, depth],
  );
  const close = useCallback(
    (fallback = '/') => once(() => void (depth > 0 ? navigate(-1) : navigate(fallback, { replace: true }))),
    [once, navigate, depth],
  );
  const home = useCallback(() => once(() => void (depth > 0 ? navigate(-depth) : navigate('/', { replace: true }))), [once, navigate, depth]);
  return useMemo(
    () => ({ open, swap, close, home, linkState: SheetHistory.above(depth) }),
    [open, swap, close, home, depth],
  );
}
