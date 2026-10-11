import { useEffect, useState } from 'react';

/** True once `ms` have passed since the hook mounted or `key` last changed. */
export function useLate(ms: number, key = 0): boolean {
  const [lateFor, setLateFor] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setLateFor(key), ms);
    return () => window.clearTimeout(timer);
  }, [ms, key]);
  return lateFor === key;
}
