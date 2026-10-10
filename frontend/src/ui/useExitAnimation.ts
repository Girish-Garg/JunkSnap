import { useCallback, useEffect, useRef, useState, type AnimationEvent } from 'react';

// Longest closing animation (sheet-out) plus margin; closes anyway if animationend never fires.
const FALLBACK_MS = 400;

function animates(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

/**
 * Plays the element's closing animation (the `closing` class) before `onClose` unmounts it. Without motion
 * (reduced motion, or no matchMedia as in tests) it closes at once; a timeout covers a lost animationend.
 * `onClose` runs once per close, whichever of animationend and the timeout comes first, so a route sheet
 * never goes back two levels.
 */
export function useExitAnimation(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const done = useRef(false);
  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onClose();
  }, [onClose]);
  const close = useCallback(() => {
    if (animates()) setClosing(true);
    else finish();
  }, [finish]);
  useEffect(() => {
    if (!closing) return undefined;
    const timer = window.setTimeout(finish, FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [closing, finish]);
  const onAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLElement>) => {
      if (closing && event.target === event.currentTarget) finish();
    },
    [closing, finish],
  );
  return { closing, close, onAnimationEnd };
}
