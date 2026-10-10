import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { RejectionReason } from '../../../domain/ReportRejection';
import { RejectionWatcher } from '../RejectionWatcher';

const SHOW_MS = 12_000;

/** Raises the toast when one of this phone's reports comes back turned down; null while hidden. */
export function useRejectionToast(): { readonly reason: RejectionReason | null; readonly dismiss: () => void } {
  const { snap } = useServices();
  const [reason, setReason] = useState<RejectionReason | null>(null);
  useEffect(() => {
    const watcher = new RejectionWatcher();
    watcher.turned(snap.queue.snapshot());
    void snap.queue.load();
    return snap.queue.subscribe(() => {
      const turned = watcher.turned(snap.queue.snapshot());
      if (turned !== null) setReason(turned);
    });
  }, [snap.queue]);
  useEffect(() => {
    if (reason === null) return undefined;
    const timer = window.setTimeout(() => setReason(null), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [reason]);
  const dismiss = useCallback(() => setReason(null), []);
  return { reason, dismiss };
}
