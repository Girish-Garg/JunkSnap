import { useMemo, useSyncExternalStore } from 'react';
import { useServices } from '../../../app/useServices';
import type { SessionFacts } from '../../../domain/GateRules';
import { useOnline } from '../../../ui/useOnline';
import { useAuthUser } from '../../auth/hooks/useAuthUser';

/** Signed in, online and the actions still cooling down after a 429: what every api action's gate reads. */
export function useSessionFacts(): SessionFacts {
  const { cooldowns } = useServices();
  const signedIn = useAuthUser() !== null;
  const online = useOnline();
  const cooling = useSyncExternalStore(
    (listener) => cooldowns.subscribe(listener),
    () => cooldowns.active(),
  );
  return useMemo(() => ({ signedIn, online, cooling }), [signedIn, online, cooling]);
}
