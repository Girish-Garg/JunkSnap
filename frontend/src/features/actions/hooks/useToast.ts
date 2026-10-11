import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useServices } from '../../../app/useServices';
import type { Toast } from '../../../services/Notifier';

/** How long one plain toast stays; the next in the queue follows. */
export const TOAST_MS = 4500;
/** The most a toast with a step (Open app settings, Try again) stays when nobody uses or closes it. */
export const STEP_TOAST_MS = 60_000;

export interface ToastState {
  readonly current: Toast | null;
  readonly dismiss: () => void;
  /** Runs the toast's own step (e.g. Open app settings) and lets the toast go. */
  readonly act: () => void;
}

/**
 * The toast on screen. A plain one leaves by itself after TOAST_MS or when dismissed; one with a step (Open app
 * settings, Try again) stays up to STEP_TOAST_MS, so there is time to read it and reach its button with a keyboard or a
 * screen reader.
 */
export function useToast(): ToastState {
  const { notifier } = useServices();
  const current = useSyncExternalStore(
    (listener) => notifier.subscribe(listener),
    () => notifier.current(),
  );
  useEffect(() => {
    if (!current) return undefined;
    const timer = window.setTimeout(() => notifier.dismiss(current.id), current.action ? STEP_TOAST_MS : TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [current, notifier]);
  const dismiss = useCallback(() => {
    if (current) notifier.dismiss(current.id);
  }, [current, notifier]);
  const act = useCallback(() => {
    dismiss();
    current?.action?.run();
  }, [current, dismiss]);
  return { current, dismiss, act };
}
