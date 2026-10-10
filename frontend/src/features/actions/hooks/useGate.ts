import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useServices } from '../../../app/useServices';
import type { Availability } from '../../../domain/ActionAvailability';
import { useAuthFlow } from '../../auth/hooks/useAuthFlow';

export type Gate = (availability: Availability, action: () => void) => () => void;

/**
 * The tap handler for any action that can be off: runs it when available; otherwise says why in a toast, or, when
 * signing in fixes it, opens sign-in with the reason and runs the action after.
 */
export function useGate(): Gate {
  const { notifier } = useServices();
  const { requireAuth } = useAuthFlow();
  const { t } = useTranslation();
  return useCallback(
    (availability, action) => () => {
      if (availability.enabled) return action();
      if (availability.remedy === 'signIn') return requireAuth(action, t(availability.reason, availability.params));
      notifier.push({ key: availability.reason, params: availability.params });
    },
    [notifier, requireAuth, t],
  );
}
