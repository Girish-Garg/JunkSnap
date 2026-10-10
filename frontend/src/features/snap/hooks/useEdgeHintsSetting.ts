import { useCallback, useSyncExternalStore } from 'react';
import { useServices } from '../../../app/useServices';

/** Settings → On-device hints: whether this device can run them, and the person's choice. */
export function useEdgeHintsSetting() {
  const { edge } = useServices();
  const preference = edge.preference;
  const subscribe = useCallback((listener: () => void) => preference.subscribe(listener), [preference]);
  const on = useSyncExternalStore(subscribe, () => preference.on(), () => preference.on());
  const set = useCallback((next: boolean) => preference.set(next), [preference]);
  return { supported: edge.supported(), on, set };
}
