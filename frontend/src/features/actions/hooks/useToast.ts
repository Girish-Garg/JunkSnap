import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useServices } from '../../../app/useServices';
import type { Toast } from '../../../services/Notifier';

/** How long one toast stays; the next in the queue follows. */
export const TOAST_MS = 4500;

/** The toast on screen, which leaves by itself after TOAST_MS or when dismissed. */
export function useToast(): { readonly current: Toast | null; readonly dismiss: () => void } {
  const { notifier } = useServices();
  const current = useSyncExternalStore(
    (listener) => notifier.subscribe(listener),
    () => notifier.current(),
  );
  useEffect(() => {
    if (!current) return undefined;
    const timer = window.setTimeout(() => notifier.dismiss(current.id), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [current, notifier]);
  const dismiss = useCallback(() => {
    if (current) notifier.dismiss(current.id);
  }, [current, notifier]);
  return { current, dismiss };
}
