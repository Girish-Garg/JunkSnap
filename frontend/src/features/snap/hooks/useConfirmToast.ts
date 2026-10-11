import { useCallback, useEffect, useState } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import type { ConfirmationAskView } from '../../../domain/ReportConfirmation';
import { ConfirmWatcher } from '../ConfirmWatcher';

/** Raises the toast (for ui.confirmToastMs) when one of this phone's reports starts waiting for the reporter's answer; null while hidden. */
export function useConfirmToast(): { readonly ask: ConfirmationAskView | null; readonly dismiss: () => void } {
  const { snap } = useServices();
  const { confirmToastMs } = useConfig().ui;
  const [ask, setAsk] = useState<ConfirmationAskView | null>(null);
  useEffect(() => {
    const watcher = new ConfirmWatcher();
    watcher.asked(snap.queue.snapshot());
    void snap.queue.load();
    return snap.queue.subscribe(() => {
      const asked = watcher.asked(snap.queue.snapshot());
      if (asked !== null) setAsk(asked);
    });
  }, [snap.queue]);
  useEffect(() => {
    if (ask === null) return undefined;
    const timer = window.setTimeout(() => setAsk(null), confirmToastMs);
    return () => window.clearTimeout(timer);
  }, [ask, confirmToastMs]);
  const dismiss = useCallback(() => setAsk(null), []);
  return { ask, dismiss };
}
