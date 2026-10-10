import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
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

export function useSheetNavigation(): SheetNavigation {
  const navigate = useNavigate();
  const depth = SheetHistory.depth(useLocation().state);
  const open = useCallback((path: string) => void navigate(path, { state: SheetHistory.above(depth) }), [navigate, depth]);
  const swap = useCallback(
    (path: string) => void navigate(path, { replace: true, state: SheetHistory.at(depth) }),
    [navigate, depth],
  );
  const close = useCallback(
    (fallback = '/') => void (depth > 0 ? navigate(-1) : navigate(fallback, { replace: true })),
    [navigate, depth],
  );
  const home = useCallback(() => void (depth > 0 ? navigate(-depth) : navigate('/', { replace: true })), [navigate, depth]);
  return useMemo(
    () => ({ open, swap, close, home, linkState: SheetHistory.above(depth) }),
    [open, swap, close, home, depth],
  );
}
