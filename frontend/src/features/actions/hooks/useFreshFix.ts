import { useCallback, useEffect, useState } from 'react';
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
  const allowed = usePermissionState('geolocation') === 'granted';
  const [fix, setFix] = useState<FreshFix | null>(null);
  // The map's fix counts from when it arrived here; stamped on the next tick, off the render.
  useEffect(() => {
    if (!mapLocation) return undefined;
    const timer = window.setTimeout(() => setFix(new FreshFix(mapLocation, Date.now())), 0);
    return () => window.clearTimeout(timer);
  }, [mapLocation]);
  const relocate = useCallback(
    () => locator.locate().then((at) => {
      const fresh = new FreshFix(at, Date.now());
      setFix(fresh);
      return fresh;
    }, () => null),
    [locator],
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
