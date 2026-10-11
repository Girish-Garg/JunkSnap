import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import type { Toast } from '../../../services/Notifier';

/** The toast on screen, which leaves by itself after ui.toastMs (the next in the queue follows) or when dismissed. */
export function useToast(): { readonly current: Toast | null; readonly dismiss: () => void } {
  const { notifier } = useServices();
  const { toastMs } = useConfig().ui;
  const current = useSyncExternalStore(
    (listener) => notifier.subscribe(listener),
    () => notifier.current(),
  );
  useEffect(() => {
    if (!current) return undefined;
    const timer = window.setTimeout(() => notifier.dismiss(current.id), toastMs);
    return () => window.clearTimeout(timer);
  }, [current, notifier, toastMs]);
  const dismiss = useCallback(() => {
    if (current) notifier.dismiss(current.id);
  }, [current, notifier]);
  return { current, dismiss };
}
