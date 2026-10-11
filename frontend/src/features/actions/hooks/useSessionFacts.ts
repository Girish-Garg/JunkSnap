import { useMemo, useSyncExternalStore } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import type { SessionFacts } from '../../../domain/GateRules';
import { useOnline } from '../../../ui/useOnline';
import { useAuthUser } from '../../auth/hooks/useAuthUser';
import { useLate } from './useLate';

/**
 * Signed in, online and the actions still cooling down after a 429: what every api action's gate reads. While the
 * saved sign-in is read the actions wait, but at most ui.checkLimitMs: a stalled token refresh then counts as signed out.
 */
export function useSessionFacts(): SessionFacts {
  const { auth, cooldowns } = useServices();
  const signedIn = useAuthUser() !== null;
  const reading = useSyncExternalStore(
    (listener) => auth.subscribe(listener),
    () => auth.restoring(),
  );
  const late = useLate(useConfig().ui.checkLimitMs);
  const restoring = reading && !late;
  const online = useOnline();
  const cooling = useSyncExternalStore(
    (listener) => cooldowns.subscribe(listener),
    () => cooldowns.active(),
  );
  return useMemo(() => ({ signedIn, restoring, online, cooling }), [signedIn, restoring, online, cooling]);
}
