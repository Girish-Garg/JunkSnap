import { useEffect, useLayoutEffect } from 'react';

/** Moves focus to the sheet title on open (and when focusKey changes); restores it on close. */
export function useSheetFocus(titleId: string, focusKey: unknown): void {
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  // Layout effect: focus lands in the same commit that renders the new title, never a frame later.
  useLayoutEffect(() => {
    document.getElementById(titleId)?.focus({ preventScroll: true });
  }, [titleId, focusKey]);
}
