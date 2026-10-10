import { useEffect } from 'react';
import { useServices } from '../../../app/useServices';
import type { QueuedReport } from '../../../domain/QueuedReport';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { useQueue } from '../../snap/hooks/useQueue';
import { useScans } from '../../snap/hooks/useScanProgress';

const REFRESH_MS = 15_000;

/** Photos and videos sent from this phone, refreshing statuses that can still change while the sheet is open. */
export function useActivity(): { readonly reports: readonly QueuedReport[]; readonly scans: readonly QueuedScan[] } {
  const { snap } = useServices();
  const reports = useQueue();
  const scans = useScans();
  useEffect(() => {
    const refresh = () => void Promise.all([snap.tracker.refreshOpen(), snap.scanTracker.refreshOpen()]);
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [snap.tracker, snap.scanTracker]);
  return { reports, scans };
}
