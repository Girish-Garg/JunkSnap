import { useCallback } from 'react';
import { useServices } from '../../../app/useServices';
import type { Availability } from '../../../domain/ActionAvailability';
import type { LocationProblem } from '../../../domain/LocationError';
import { useNativeBridge } from '../../../ui/useNativeBridge';

/** problem: what kept the fix; why: the action's gate with location blocked, for its reason; retry: asks again. */
export type LocationHelp = (problem: LocationProblem, why: Availability, retry: () => void) => void;

// Location off or too slow: the line, and Try again.
const RETRY_LINES: Readonly<Record<Exclude<LocationProblem, 'denied'>, string>> = {
  unavailable: 'location.off',
  timeout: 'location.timeout',
};

/**
 * Says in the app toast what kept the person's location, with the one step that fixes it. Blocked: the action's reason,
 * then inside the Android app "Open app settings", in a browser where to allow it and Try again. Off or slow: Try again.
 */
export function useLocationHelp(): LocationHelp {
  const { notifier } = useServices();
  const native = useNativeBridge();
  return useCallback(
    (problem, why, retry) => {
      const tryAgain = { key: 'snap.tryAgain', run: retry };
      if (problem !== 'denied') return notifier.push({ key: RETRY_LINES[problem], action: tryAgain });
      const inApp = native.canOpenAppSettings();
      const detail = inApp ? 'location.deniedApp' : 'location.denied';
      const action = inApp ? { key: 'snap.openSettings', run: () => native.openAppSettings() } : tryAgain;
      const reason = why.enabled ? { key: detail } : { key: why.reason, params: why.params, detail };
      notifier.push({ ...reason, action });
    },
    [notifier, native],
  );
}
