import { useCallback, useEffect, useState } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import type { RejectionReason } from '../../../domain/ReportRejection';
import { RejectionWatcher } from '../RejectionWatcher';

/** Raises the toast (for ui.rejectionToastMs) when one of this phone's reports comes back turned down; null while hidden. */
export function useRejectionToast(): { readonly reason: RejectionReason | null; readonly dismiss: () => void } {
  const { snap } = useServices();
  const { rejectionToastMs } = useConfig().ui;
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
    const timer = window.setTimeout(() => setReason(null), rejectionToastMs);
    return () => window.clearTimeout(timer);
  }, [reason, rejectionToastMs]);
  const dismiss = useCallback(() => setReason(null), []);
  return { reason, dismiss };
}
