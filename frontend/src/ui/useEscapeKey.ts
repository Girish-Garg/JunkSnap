import { useEffect, type RefObject } from 'react';

export const ESCAPE_LAYER = 'data-escape-layer';

/** Escape reaches only the topmost layer: the last [data-escape-layer] in the page, which also paints on top. */
export function useEscapeKey(onEscape: () => void, layer: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const layers = document.querySelectorAll(`[${ESCAPE_LAYER}]`);
      if (layers[layers.length - 1] === layer.current) onEscape();
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [onEscape, layer]);
}
