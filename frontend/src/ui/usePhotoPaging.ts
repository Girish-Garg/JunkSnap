import { useCallback, useEffect } from 'react';
import type { GestureOutcome } from './PhotoGesture';
import type { PhotoViewerControl } from './usePhotoViewer';

export interface PhotoPaging {
  readonly previous: () => void;
  readonly next: () => void;
  readonly onOutcome: (outcome: GestureOutcome) => void;
}

/** Previous and next from buttons, arrow keys and swipes; a swipe down closes. */
export function usePhotoPaging(index: number, viewer: PhotoViewerControl): PhotoPaging {
  const { show, close } = viewer;
  const previous = useCallback(() => show(index - 1), [show, index]);
  const next = useCallback(() => show(index + 1), [show, index]);
  const onOutcome = useCallback(
    (outcome: GestureOutcome) => ({ next, previous, close, none: () => undefined })[outcome](),
    [next, previous, close],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') previous();
      if (event.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previous, next]);
  return { previous, next, onOutcome };
}
