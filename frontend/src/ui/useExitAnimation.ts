import { useCallback, useState, type AnimationEvent } from 'react';

function animates(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

/**
 * Plays the element's closing animation (the `closing` class) before `onClose` unmounts it. Without motion
 * (reduced motion, or no matchMedia as in tests) it closes at once.
 */
export function useExitAnimation(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const close = useCallback(() => {
    if (animates()) setClosing(true);
    else onClose();
  }, [onClose]);
  const onAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLElement>) => {
      if (closing && event.target === event.currentTarget) onClose();
    },
    [closing, onClose],
  );
  return { closing, close, onAnimationEnd };
}
