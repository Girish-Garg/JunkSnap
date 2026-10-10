import { useEffect, useSyncExternalStore } from 'react';
import { useServices } from '../../../app/useServices';
import type { QueuedReport } from '../../../domain/QueuedReport';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { useQueue } from '../../snap/hooks/useQueue';
import { useScans } from '../../snap/hooks/useScanProgress';

const REFRESH_MS = 15_000;

/**
 * Photos and videos from this phone, shown at once. While the sheet is open it revalidates the list with the
 * server when its token is stale (ActivitySync) and refreshes statuses that can still change. Sent rows show
 * only once the list is confirmed to be the signed-in account's; until then, only unsent ones.
 */
export function useActivity(): { readonly reports: readonly QueuedReport[]; readonly scans: readonly QueuedScan[] } {
  const { snap } = useServices();
  const reports = useQueue();
  const scans = useScans();
  const trusted = useSyncExternalStore(
    (listener) => snap.activity.subscribe(listener),
    () => snap.activity.trusted(),
  );
  useEffect(() => {
    const statuses = () => Promise.all([snap.tracker.refreshOpen(), snap.scanTracker.refreshOpen()]);
    // The list first, so rows it brings back get their statuses refreshed in the same pass.
    const refresh = () => void snap.activity.revalidate().then(statuses, statuses);
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [snap.activity, snap.tracker, snap.scanTracker]);
  if (trusted) return { reports, scans };
  return { reports: reports.filter((row) => row.data.stage !== 'sent'), scans: scans.filter((scan) => scan.data.stage !== 'sent') };
}
