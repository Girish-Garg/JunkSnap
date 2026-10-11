import { useEffect, useSyncExternalStore } from 'react';
import { useServices } from '../../../app/useServices';
import type { LocationAnswer } from '../../../services/LocationAccess';
import { DocumentVisibility } from '../../../services/PageVisibility';

/**
 * Whether location is allowed, as far as the app can tell. Read again when a sheet opens, when the browser says it
 * changed, and whenever the page comes back on screen (the person may have changed it in the settings meanwhile); the
 * tiles then update by themselves.
 */
export function useLocationAccess(): LocationAnswer {
  const { locationAccess } = useServices();
  useEffect(() => {
    const page = new DocumentVisibility(document);
    void locationAccess.refresh();
    const stopWatching = locationAccess.watch();
    const stopVisibility = page.subscribe(() => {
      if (page.visible()) void locationAccess.refresh();
    });
    return () => {
      stopWatching();
      stopVisibility();
    };
  }, [locationAccess]);
  return useSyncExternalStore(
    (listener) => locationAccess.subscribe(listener),
    () => locationAccess.answer(),
  );
}
