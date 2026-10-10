import { useRef, type PointerEvent } from 'react';

// A flick at least this long, mostly sideways and quick, steps; anything else is a tap or a scroll.
const MIN_DISTANCE_PX = 48;
const SIDEWAYS_RATIO = 1.5;
const MAX_DURATION_MS = 600;

interface Start {
  readonly x: number;
  readonly y: number;
  readonly at: number;
}

/**
 * A sideways swipe on a floating card: left for next, right for previous. It only reads pointer down and up,
 * so taps and the buttons inside still work, and anything marked data-own-drag inside keeps its own drag.
 * The element needs `touch-action: pan-y`, so the browser hands sideways moves to the page.
 */
export function useSwipeStep(onPrevious: (() => void) | null, onNext: (() => void) | null) {
  const start = useRef<Start | null>(null);
  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    const owned = event.target instanceof Element && event.target.closest('[data-own-drag]');
    start.current = owned || !event.isPrimary ? null : { x: event.clientX, y: event.clientY, at: event.timeStamp };
  };
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const from = start.current;
    start.current = null;
    if (!from || event.timeStamp - from.at > MAX_DURATION_MS) return;
    const dx = event.clientX - from.x;
    const sideways = Math.abs(dx) >= MIN_DISTANCE_PX && Math.abs(dx) > Math.abs(event.clientY - from.y) * SIDEWAYS_RATIO;
    if (sideways) (dx < 0 ? onNext : onPrevious)?.();
  };
  const onPointerCancel = () => {
    start.current = null;
  };
  return { onPointerDown, onPointerUp, onPointerCancel };
}
