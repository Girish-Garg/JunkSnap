import { useCallback, useEffect, useRef } from 'react';
import { HistoryLayers } from './HistoryLayers';

const MARKER = 'junksnapPhotoViewer';

const ownsTopEntry = () => (window.history.state as Record<string, unknown> | null)?.[MARKER] === true;

export interface ViewerHistory {
  /** Pushes the viewer's entry on the same URL, once. */
  readonly push: () => void;
  /** Pops the viewer's entry if it is still on top, then runs after once the step back has landed (at once without one). */
  readonly pop: (after?: () => void) => void;
}

/**
 * The viewer's history entry, so the Android and browser back button closes it instead of leaving the
 * page. Back calls onBack; unmounting while open (the sheet closes under it) pops the entry too.
 */
export function useViewerHistory(isOpen: boolean, onBack: () => void): ViewerHistory {
  const pushed = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    const onPop = () => {
      pushed.current = false;
      onBack();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [isOpen, onBack]);

  const push = useCallback(() => {
    if (!ownsTopEntry()) window.history.pushState({ ...(window.history.state as object | null), [MARKER]: true }, '');
    pushed.current = true;
  }, []);

  const pop = useCallback((after?: () => void) => {
    const owned = pushed.current && ownsTopEntry();
    pushed.current = false;
    if (!owned) return after?.();
    if (after) HistoryLayers.afterPop(after);
    window.history.back();
  }, []);

  // Unmounting while open pops the entry, so back does not land on a viewer that is gone.
  useEffect(() => pop, [pop]);

  return { push, pop };
}
