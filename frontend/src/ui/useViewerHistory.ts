import { useCallback, useEffect, useRef } from 'react';

const MARKER = 'junksnapPhotoViewer';

const ownsTopEntry = () => (window.history.state as Record<string, unknown> | null)?.[MARKER] === true;

export interface ViewerHistory {
  /** Pushes the viewer's entry on the same URL, once. */
  readonly push: () => void;
  /** Pops the viewer's entry if it is still on top. */
  readonly pop: () => void;
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

  const pop = useCallback(() => {
    if (pushed.current && ownsTopEntry()) window.history.back();
    pushed.current = false;
  }, []);

  // Unmounting while open pops the entry, so back does not land on a viewer that is gone.
  useEffect(() => pop, [pop]);

  return { push, pop };
}
