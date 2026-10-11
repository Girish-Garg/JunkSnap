import { useCallback, useEffect, useRef } from 'react';
import { useServices } from '../../../app/useServices';
import type { Availability } from '../../../domain/ActionAvailability';
import type { LocationProblem } from '../../../domain/LocationError';
import type { NativeBridge } from '../../../services/NativeBridge';
import type { ToastInput } from '../../../services/Notifier';
import { useNativeBridge } from '../../../ui/useNativeBridge';

/** problem: what kept the fix; why: the action's gate with location blocked, for its reason; retry: asks again. */
export type LocationHelp = (problem: LocationProblem, why: Availability, retry: () => void) => void;

// Location off or too slow: the line, and Try again.
const RETRY_LINES: Readonly<Record<Exclude<LocationProblem, 'denied'>, string>> = {
  unavailable: 'location.off',
  timeout: 'location.timeout',
};

// The toast for one problem: blocked says the action's reason and how to allow location; off or slow offers Try again.
function helpToast(problem: LocationProblem, why: Availability, retry: () => void, native: NativeBridge): ToastInput {
  const tryAgain = { key: 'snap.tryAgain', run: retry };
  if (problem !== 'denied') return { key: RETRY_LINES[problem], action: tryAgain };
  const inApp = native.canOpenAppSettings();
  const detail = inApp ? 'location.deniedApp' : 'location.denied';
  const action = inApp ? { key: 'snap.openSettings', run: () => native.openAppSettings() } : tryAgain;
  return why.enabled ? { key: detail, action } : { key: why.reason, params: why.params, detail, action };
}

/**
 * Says in the app toast what kept the person's location, with the one step that fixes it. Blocked: the action's reason,
 * then inside the Android app "Open app settings", in a browser where to allow it and Try again. Off or slow: Try again.
 * The toasts leave with the sheet that showed them, and a late answer to the location prompt after the sheet closed
 * shows nothing, so a Try again never acts for a site that is gone.
 */
export function useLocationHelp(): LocationHelp {
  const { notifier } = useServices();
  const native = useNativeBridge();
  // The ids of the toasts shown while the sheet is open; null before it opens and once it has closed.
  const shown = useRef<Set<number> | null>(null);
  useEffect(() => {
    const ids = new Set<number>();
    shown.current = ids;
    return () => {
      shown.current = null;
      ids.forEach((id) => notifier.dismiss(id));
    };
  }, [notifier]);
  return useCallback(
    (problem, why, retry) => {
      const ids = shown.current;
      if (ids) ids.add(notifier.push(helpToast(problem, why, retry, native)));
    },
    [notifier, native],
  );
}
