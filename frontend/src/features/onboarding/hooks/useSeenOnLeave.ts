import { useEffect, useRef } from 'react';
import type { OnboardingPreference } from '../../../services/OnboardingPreference';

/**
 * Leaving the cards any way counts as seen: Android's back button and the browser's unmount them without a
 * button. StrictMode unmounts and mounts again at once, so only a leave that still holds after a tick counts.
 */
export function useSeenOnLeave(onboarding: OnboardingPreference): void {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.setTimeout(() => {
        if (!mounted.current) onboarding.markSeen();
      }, 0);
    };
  }, [onboarding]);
}
