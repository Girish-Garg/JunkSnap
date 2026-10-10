import { useEffect, useSyncExternalStore } from 'react';
import { useServices } from '../../../app/useServices';
import type { QueuedReport } from '../../../domain/QueuedReport';

/** This phone's reports, newest first, live as the queue sends them. */
export function useQueue(): readonly QueuedReport[] {
  const { snap } = useServices();
  useEffect(() => {
    void snap.queue.load();
  }, [snap.queue]);
  return useSyncExternalStore(
    (listener) => snap.queue.subscribe(listener),
    () => snap.queue.snapshot(),
  );
}
