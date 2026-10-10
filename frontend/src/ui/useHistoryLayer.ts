import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

// A layer's token sits in history.state.layers while its entry is in the stack.
function layersOf(state: unknown): readonly string[] {
  if (typeof state !== 'object' || state === null || !('layers' in state)) return [];
  return Array.isArray(state.layers) ? state.layers.filter((item): item is string => typeof item === 'string') : [];
}

// Pushes the layer's entry once; StrictMode's second effect run finds it already there.
function pushLayer(token: string): void {
  const state: unknown = window.history.state;
  if (layersOf(state).includes(token)) return;
  const base = typeof state === 'object' && state !== null ? state : {};
  window.history.pushState({ ...base, layers: [...layersOf(state), token] }, '');
}

// Closes the layer once back has taken its entry off the stack, then runs whatever waited for that.
function onLeave(token: string, close: RefObject<() => void>, after: RefObject<(() => void) | null>): () => void {
  return () => {
    if (layersOf(window.history.state).includes(token)) return;
    const next = after.current;
    after.current = null;
    close.current();
    next?.();
  };
}

// A layer that unmounts while still open (e.g. the desktop dialog when the window narrows) takes its entry with it.
// StrictMode remounts at once, so only a real unmount still has the flag down when the timeout runs.
function useDropOnUnmount(token: string): void {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.setTimeout(() => {
        if (!mounted.current && layersOf(window.history.state).at(-1) === token) window.history.back();
      }, 0);
    };
  }, [token]);
}

/**
 * Gives a sheet or dialog that is not a route its own history entry while it is open, so the hardware back
 * button (Android) and the browser back button close it instead of leaving the app. Returns `dismiss`: close
 * through history, then run `after` once the entry is gone (so a following navigation cannot be undone).
 */
export function useHistoryLayer(name: string, open: boolean, onClose: () => void): (after?: () => void) => void {
  const [token] = useState(() => `${name}-${Math.random().toString(36).slice(2)}`);
  const closeRef = useRef(onClose);
  const afterRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useDropOnUnmount(token);
  useEffect(() => {
    if (!open) return;
    pushLayer(token);
    const listener = onLeave(token, closeRef, afterRef);
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, [open, token]);
  return useCallback(
    (after?: () => void) => {
      if (layersOf(window.history.state).at(-1) !== token) {
        closeRef.current();
        after?.();
        return;
      }
      afterRef.current = after ?? null;
      window.history.back();
    },
    [token],
  );
}
