import { useSyncExternalStore } from 'react';
import { useServices } from '../../../app/useServices';
import type { AuthUser } from '../../../services/AuthService';

export function useAuthUser(): AuthUser | null {
  const { auth } = useServices();
  return useSyncExternalStore(
    (listener) => auth.subscribe(listener),
    () => auth.currentUser(),
  );
}
