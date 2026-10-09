import { useEffect, useState } from 'react';

/** Seconds left before an action may repeat; restart() begins a new wait. */
export function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = window.setTimeout(() => setLeft(left - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [left]);
  return { left, restart: () => setLeft(seconds) };
}
