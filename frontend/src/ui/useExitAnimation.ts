import { useCallback, useEffect, useState, type AnimationEvent } from 'react';

// Longest closing animation (sheet-out) plus margin; closes anyway if animationend never fires.
const FALLBACK_MS = 400;

function animates(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

/**
 * Plays the element's closing animation (the `closing` class) before `onClose` unmounts it. Without motion
 * (reduced motion, or no matchMedia as in tests) it closes at once; a timeout covers a lost animationend.
 */
export function useExitAnimation(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    if (animates()) setClosing(true);
    else onClose();
  }, [onClose]);
  useEffect(() => {
    if (!closing) return undefined;
    const timer = window.setTimeout(onClose, FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [closing, onClose]);
  const onAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLElement>) => {
      if (closing && event.target === event.currentTarget) onClose();
    },
    [closing, onClose],
  );
  return { closing, close, onAnimationEnd };
}
