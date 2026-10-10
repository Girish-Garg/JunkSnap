import { useEffect } from 'react';
import { useServices } from '../../../app/useServices';
import type { QueuedReport } from '../../../domain/QueuedReport';
import { useQueue } from '../../snap/hooks/useQueue';

const REFRESH_MS = 15_000;

/** The reports sent from this phone, refreshing statuses that can still change while the sheet is open. */
export function useActivity(): readonly QueuedReport[] {
  const { snap } = useServices();
  const reports = useQueue();
  useEffect(() => {
    void snap.tracker.refreshOpen();
    const timer = window.setInterval(() => void snap.tracker.refreshOpen(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [snap.tracker]);
  return reports;
}
