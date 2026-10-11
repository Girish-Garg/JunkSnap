import { useEffect, useSyncExternalStore } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import type { QueuedScan } from '../../../domain/QueuedScan';
import { ScanTracker } from '../../../services/ScanTracker';

/** This phone's scans, newest first, live as the queue sends them. */
export function useScans(): readonly QueuedScan[] {
  const { snap } = useServices();
  useEffect(() => {
    void snap.scans.load();
  }, [snap.scans]);
  return useSyncExternalStore(
    (listener) => snap.scans.subscribe(listener),
    () => snap.scans.snapshot(),
  );
}

/** One queued scan, polling GET /scans/{id} until the worker is done or failed. */
export function useScanProgress(id: string): QueuedScan | undefined {
  const { snap } = useServices();
  const { scanPollMs } = useConfig().cache;
  const scan = useScans().find((candidate) => candidate.id === id);
  const polling = scan !== undefined && ScanTracker.isOpen(scan);
  useEffect(() => {
    if (!polling) return undefined;
    void snap.scanTracker.refresh(id);
    const timer = window.setInterval(() => void snap.scanTracker.refresh(id), scanPollMs);
    return () => window.clearInterval(timer);
  }, [polling, id, snap.scanTracker, scanPollMs]);
  return scan;
}
