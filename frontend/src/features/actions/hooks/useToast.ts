import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import type { Toast } from '../../../services/Notifier';

export interface ToastState {
  readonly current: Toast | null;
  readonly dismiss: () => void;
  /** Runs the toast's own step (e.g. Open app settings) and lets the toast go. */
  readonly act: () => void;
}

/**
 * The toast on screen. A plain one leaves by itself after ui.toastMs (the next in the queue follows) or when
 * dismissed; one with a step (Open app settings, Try again) stays up to ui.stepToastMs, so there is time to read it and
 * reach its button with a keyboard or a screen reader.
 */
export function useToast(): ToastState {
  const { notifier } = useServices();
  const { toastMs, stepToastMs } = useConfig().ui;
  const current = useSyncExternalStore(
    (listener) => notifier.subscribe(listener),
    () => notifier.current(),
  );
  useEffect(() => {
    if (!current) return undefined;
    const timer = window.setTimeout(() => notifier.dismiss(current.id), current.action ? stepToastMs : toastMs);
    return () => window.clearTimeout(timer);
  }, [current, notifier, toastMs, stepToastMs]);
  const dismiss = useCallback(() => {
    if (current) notifier.dismiss(current.id);
  }, [current, notifier]);
  const act = useCallback(() => {
    dismiss();
    current?.action?.run();
  }, [current, dismiss]);
  return { current, dismiss, act };
}
