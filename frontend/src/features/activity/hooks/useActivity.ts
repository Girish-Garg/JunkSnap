import { useEffect, useSyncExternalStore } from 'react';
import { useServices } from '../../../app/useServices';
import type { QueuedReport } from '../../../domain/QueuedReport';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { useQueue } from '../../snap/hooks/useQueue';
import { useScans } from '../../snap/hooks/useScanProgress';

const REFRESH_MS = 15_000;

export interface ActivityRows {
  readonly reports: readonly QueuedReport[];
  readonly scans: readonly QueuedScan[];
  /** The first sync is still on its way, so an empty list is not known to be empty yet. */
  readonly loading: boolean;
}

/**
 * Photos and videos from this phone, shown at once. While the sheet is open it revalidates the list with the
 * server when its token is stale (ActivitySync) and refreshes statuses that can still change. Sent rows show
 * only once the list is confirmed to be the signed-in account's; until then, only unsent ones.
 */
export function useActivity(): ActivityRows {
  const { snap } = useServices();
  const reports = useQueue();
  const scans = useScans();
  const state = useSyncExternalStore(
    (listener) => snap.activity.subscribe(listener),
    () => snap.activity.state(),
  );
  useActivityRefresh(state.generation);
  if (state.trusted) return { reports, scans, loading: false };
  return { reports: reports.filter((row) => row.data.stage !== 'sent'), scans: scans.filter((scan) => scan.data.stage !== 'sent'), loading: state.loading };
}

// At once and every REFRESH_MS while the sheet is open; a sign-in change (a new generation) starts again at once.
// A failure is a load's: reported with the structured tag, and the phone's copy stays.
function useActivityRefresh(generation: number): void {
  const { snap, errors } = useServices();
  useEffect(() => {
    const failed = (error: unknown) => void errors.report('activity', error);
    const statuses = () => Promise.all([snap.tracker.refreshOpen(), snap.scanTracker.refreshOpen()]);
    // The list first, so rows it brings back get their statuses refreshed in the same pass.
    const refresh = () => void snap.activity.revalidate().catch(failed).then(statuses).catch(failed);
    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [snap.activity, snap.tracker, snap.scanTracker, errors, generation]);
}
