import { useCallback, useEffect, useState } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import { FreshFix } from '../../../domain/FreshFix';
import type { LonLat } from '../../../domain/Site';
import { usePermissionState } from '../../../ui/usePermissionState';

export interface FreshLocation {
  /** A fix under 2 minutes old, or null; it turns null by itself when it gets stale. */
  readonly fix: FreshFix | null;
  /** Takes a fresh fix; null when the browser gives none. */
  readonly relocate: () => Promise<FreshFix | null>;
}

/**
 * The person's location for distance gates: the map's fix (as old as its last change) or a fresh one taken when the
 * sheet opens, only if location is already allowed so opening a sheet never prompts.
 */
export function useFreshFix(mapLocation: LonLat | null): FreshLocation {
  const { locator } = useServices();
  const { freshFixMs } = useConfig().capture;
  const allowed = usePermissionState('geolocation') === 'granted';
  // The map's fix counts from when it arrived here: at once on the first render, later ones on the next tick.
  const [fix, setFix] = useState<FreshFix | null>(() => (mapLocation ? new FreshFix(mapLocation, Date.now(), freshFixMs) : null));
  useEffect(() => {
    if (!mapLocation) return undefined;
    const stamp = () => setFix((current) => (current?.at === mapLocation ? current : new FreshFix(mapLocation, Date.now(), freshFixMs)));
    const timer = window.setTimeout(stamp, 0);
    return () => window.clearTimeout(timer);
  }, [mapLocation, freshFixMs]);
  const relocate = useCallback(
    () => locator.locate().then((at) => {
      const fresh = new FreshFix(at, Date.now(), freshFixMs);
      setFix(fresh);
      return fresh;
    }, () => null),
    [locator, freshFixMs],
  );
  useEffect(() => {
    if (allowed) void relocate();
  }, [allowed, relocate]);
  useEffect(() => {
    if (!fix) return undefined;
    const timer = window.setTimeout(() => setFix((current) => (current === fix ? null : current)), fix.msLeft(Date.now()));
    return () => window.clearTimeout(timer);
  }, [fix]);
  return { fix, relocate };
}
