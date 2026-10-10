import { useEffect, type RefObject } from 'react';
import { LAYER_ATTRIBUTE, TopLayer } from './TopLayer';

export const ESCAPE_LAYER = LAYER_ATTRIBUTE;

/**
 * Escape, and a map tap on phones (TopLayer.dismiss), reach only the topmost layer: the last
 * [data-escape-layer] in the page, which also paints on top and owns the top history entry.
 */
export function useEscapeKey(onEscape: () => void, layer: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && TopLayer.is(layer.current)) onEscape();
    };
    const handleDismiss = () => {
      if (TopLayer.is(layer.current)) onEscape();
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener(TopLayer.event, handleDismiss);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener(TopLayer.event, handleDismiss);
    };
  }, [onEscape, layer]);
}
