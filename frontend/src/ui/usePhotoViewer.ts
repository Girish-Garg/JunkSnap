import { useCallback, useState } from 'react';
import { useViewerHistory } from './useViewerHistory';
import type { ViewerPhoto } from './ViewerPhoto';

export interface PhotoViewerState {
  readonly photos: readonly ViewerPhoto[];
  readonly index: number;
}

export interface PhotoViewerControl {
  readonly state: PhotoViewerState | null;
  readonly open: (photos: readonly ViewerPhoto[], index: number) => void;
  readonly close: () => void;
  /** Closes, then runs after once the viewer's history entry is gone, so a sheet opened next keeps its own. */
  readonly closeThen: (after: () => void) => void;
  readonly show: (index: number) => void;
}

const clampIndex = (index: number, count: number) => Math.min(Math.max(0, index), count - 1);

/** Open and close the full-screen viewer; the back button closes it (useViewerHistory). */
export function usePhotoViewer(): PhotoViewerControl {
  const [state, setState] = useState<PhotoViewerState | null>(null);
  const dismiss = useCallback(() => setState(null), []);
  const history = useViewerHistory(state !== null, dismiss);
  const { push, pop } = history;

  const open = useCallback(
    (photos: readonly ViewerPhoto[], index: number) => {
      if (photos.length === 0) return;
      push();
      setState({ photos, index: clampIndex(index, photos.length) });
    },
    [push],
  );

  const closeThen = useCallback(
    (after?: () => void) => {
      setState(null);
      pop(after);
    },
    [pop],
  );
  const close = useCallback(() => closeThen(), [closeThen]);

  const show = useCallback((index: number) => {
    setState((current) => (current ? { ...current, index: clampIndex(index, current.photos.length) } : current));
  }, []);

  return { state, open, close, closeThen, show };
}
