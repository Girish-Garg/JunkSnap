import { useCallback, useEffect, useState } from 'react';
import type { ViewerPhoto } from './ViewerPhoto';

const MARKER = 'junksnapPhotoViewer';

export interface PhotoViewerState {
  readonly photos: readonly ViewerPhoto[];
  readonly index: number;
}

export interface PhotoViewerControl {
  readonly state: PhotoViewerState | null;
  readonly open: (photos: readonly ViewerPhoto[], index: number) => void;
  readonly close: () => void;
  readonly show: (index: number) => void;
}

const ownsTopEntry = () => (window.history.state as Record<string, unknown> | null)?.[MARKER] === true;

/**
 * Open and close the full-screen viewer. Opening pushes a history entry on the same URL, so the
 * Android and browser back button closes the viewer instead of leaving the page.
 */
export function usePhotoViewer(): PhotoViewerControl {
  const [state, setState] = useState<PhotoViewerState | null>(null);
  const isOpen = state !== null;

  useEffect(() => {
    if (!isOpen) return;
    const onBack = () => setState(null);
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, [isOpen]);

  const open = useCallback((photos: readonly ViewerPhoto[], index: number) => {
    if (photos.length === 0) return;
    if (!ownsTopEntry()) window.history.pushState({ ...(window.history.state as object | null), [MARKER]: true }, '');
    setState({ photos, index: Math.min(Math.max(0, index), photos.length - 1) });
  }, []);

  const close = useCallback(() => {
    setState(null);
    if (ownsTopEntry()) window.history.back();
  }, []);

  const show = useCallback((index: number) => {
    setState((current) => (current ? { ...current, index: Math.min(Math.max(0, index), current.photos.length - 1) } : current));
  }, []);

  return { state, open, close, show };
}
