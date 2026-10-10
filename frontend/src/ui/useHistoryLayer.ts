import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { HistoryLayers } from './HistoryLayers';

// Closes the layer once back has taken its entry off the stack, then runs whatever waited for that.
function onLeave(token: string, close: RefObject<() => void>, after: RefObject<(() => void) | null>): () => void {
  return () => {
    if (HistoryLayers.open().includes(token)) return;
    const next = after.current;
    after.current = null;
    close.current();
    next?.();
  };
}

// A layer that closes or unmounts without going through history (a map tap that clears the preview card, the
// desktop dialog when the window narrows) takes its entry with it. StrictMode closes and reopens at once, so
// only a real close still has the flag down when the timeout runs; an unwind already on its way back is left be.
function dropLater(token: string, live: RefObject<boolean>): void {
  window.setTimeout(() => {
    if (live.current || HistoryLayers.leaving()) return;
    if (HistoryLayers.open().at(-1) === token) HistoryLayers.back();
  }, 0);
}

/**
 * Gives a sheet or dialog that is not a route its own history entry while it is open, so the hardware back
 * button (Android) and the browser back button close it instead of leaving the app. Returns `dismiss`: close
 * through history, then run `after` once the entry is gone (so a following navigation cannot be undone).
 * Opening a route sheet unwinds every open layer first (useSheetNavigation), so none is left underneath.
 */
export function useHistoryLayer(name: string, open: boolean, onClose: () => void): (after?: () => void) => void {
  const [token] = useState(() => `${name}-${Math.random().toString(36).slice(2)}`);
  const closeRef = useRef(onClose);
  const afterRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useLayerEntry(token, open, closeRef, afterRef);
  return useCallback(
    function dismiss(after?: () => void) {
      // A step back already on its way (a field letting go, a double tap) lands first, so this never pops two.
      if (HistoryLayers.leaving()) return HistoryLayers.afterPop(() => dismiss(after));
      if (HistoryLayers.open().at(-1) !== token) {
        closeRef.current();
        after?.();
        return;
      }
      afterRef.current = after ?? null;
      HistoryLayers.back();
    },
    [token],
  );
}

// While open, the layer's entry sits on the stack and back closes the layer.
function useLayerEntry(token: string, open: boolean, closeRef: RefObject<() => void>, afterRef: RefObject<(() => void) | null>): void {
  const live = useRef(false);
  useEffect(() => {
    if (!open) return undefined;
    live.current = true;
    HistoryLayers.push(token);
    const listener = onLeave(token, closeRef, afterRef);
    window.addEventListener('popstate', listener);
    return () => {
      live.current = false;
      window.removeEventListener('popstate', listener);
      dropLater(token, live);
    };
  }, [open, token, closeRef, afterRef]);
}
