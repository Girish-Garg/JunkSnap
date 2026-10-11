import { useEffect, useState } from 'react';
import { useConfig } from '../../../app/useConfig';

/** The clock in ms, ticking every intervalMs (ui.clockTickMs unless given), so "2 min ago" stays true while a sheet is open. */
export function useNow(intervalMs?: number): number {
  const { clockTickMs } = useConfig().ui;
  const every = intervalMs ?? clockTickMs;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), every);
    return () => window.clearInterval(timer);
  }, [every]);
  return now;
}
