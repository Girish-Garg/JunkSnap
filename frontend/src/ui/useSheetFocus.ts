import { useLayoutEffect, useRef } from 'react';

/**
 * Moves focus to the sheet title on open (and when focusKey changes); gives it back to the opener on close.
 * The opener is read in the first layout effect, before the second one moves focus to the title.
 */
export function useSheetFocus(titleId: string, focusKey: unknown): void {
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
    };
  }, []);
  // Layout effect: focus lands in the same commit that renders the new title, never a frame later.
  useLayoutEffect(() => {
    document.getElementById(titleId)?.focus({ preventScroll: true });
  }, [titleId, focusKey]);
}
