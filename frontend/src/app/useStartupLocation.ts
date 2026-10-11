import { useEffect } from 'react';
import { useServices } from './useServices';

/**
 * Takes the one start-up fix as soon as the start screens are clear, so a prompt never shows on top of them.
 * StartupLocation decides the rest: the setting, a quiet fix when allowed, the ask when undecided and never refused,
 * nothing when blocked.
 */
export function useStartupLocation(clear: boolean): void {
  const { startupLocation } = useServices();
  useEffect(() => {
    if (clear) void startupLocation.locateOnce();
  }, [clear, startupLocation]);
}
