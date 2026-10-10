import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { RejectionWatcher } from '../RejectionWatcher';

const SHOW_MS = 12_000;

/** Raises the not-waste toast when one of this phone's reports comes back turned down. */
export function useRejectionToast(): { readonly shown: boolean; readonly dismiss: () => void } {
  const { snap } = useServices();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const watcher = new RejectionWatcher();
    watcher.turned(snap.queue.snapshot());
    void snap.queue.load();
    return snap.queue.subscribe(() => {
      if (watcher.turned(snap.queue.snapshot())) setShown(true);
    });
  }, [snap.queue]);
  useEffect(() => {
    if (!shown) return undefined;
    const timer = window.setTimeout(() => setShown(false), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [shown]);
  const dismiss = useCallback(() => setShown(false), []);
  return { shown, dismiss };
}
