import { useEffect, useState } from 'react';

/**
 * How long an action waits on something still loading (the saved sign-in, this person's reports) before it stops
 * waiting and the api's own answer decides. Counted from when the sheet opens or the sign-in changes.
 */
export const CHECK_LIMIT_MS = 8_000;

/** True once `ms` have passed since the hook mounted or `key` last changed. */
export function useLate(ms: number, key = 0): boolean {
  const [lateFor, setLateFor] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setLateFor(key), ms);
    return () => window.clearTimeout(timer);
  }, [ms, key]);
  return lateFor === key;
}
