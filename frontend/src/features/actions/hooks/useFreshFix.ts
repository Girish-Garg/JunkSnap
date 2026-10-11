import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { FreshFix } from '../../../domain/FreshFix';
import { LocationError, type LocationProblem } from '../../../domain/LocationError';
import type { LonLat } from '../../../domain/Site';

export interface FreshLocation {
  /** A fix under 2 minutes old, or null; it turns null by itself when it gets stale. */
  readonly fix: FreshFix | null;
  /** No fix yet, but one is on its way: without asking (location is allowed) or after a tap asked for it. */
  readonly locating: boolean;
  /** Takes a fresh fix (the browser or Android may ask the person); what went wrong when there is none. */
  readonly relocate: () => Promise<FreshFix | LocationProblem>;
}

type SetFix = (change: (current: FreshFix | null) => FreshFix | null) => void;

/**
 * The person's location for distance gates: the map's fix (as old as its last change) or a fresh one taken when the
 * sheet opens or the fix gets stale, only if location is already allowed so opening a sheet never prompts.
 */
export function useFreshFix(mapLocation: LonLat | null): FreshLocation {
  const [fix, setFix] = useState<FreshFix | null>(() => (mapLocation ? new FreshFix(mapLocation, Date.now()) : null));
  useMapFix(mapLocation, setFix);
  const locating = useQuietFix(fix, setFix, mapLocation === null);
  const { relocate, asking } = useTapFix(setFix);
  return { fix, locating: (locating || asking) && fix === null, relocate };
}

// A fix a tap asked for: it may show the location prompt, and the distance actions wait while it comes. Each answer
// tells LocationAccess whether location is allowed, so the tiles say so.
function useTapFix(setFix: SetFix): { readonly relocate: FreshLocation['relocate']; readonly asking: boolean } {
  const { locator, locationAccess } = useServices();
  const [asking, setAsking] = useState(false);
  const relocate = useCallback(async () => {
    setAsking(true);
    try {
      const fresh = new FreshFix(await locator.locate(), Date.now());
      setFix(() => fresh);
      locationAccess.learn('granted');
      return fresh;
    } catch (error) {
      const problem = error instanceof LocationError ? error.problem : 'unavailable';
      locationAccess.learn(problem);
      return problem;
    } finally {
      setAsking(false);
    }
  }, [locator, locationAccess, setFix]);
  return { relocate, asking };
}

// The map's fix counts from when it arrived here: at once on the first render, later ones on the next tick.
function useMapFix(mapLocation: LonLat | null, setFix: SetFix): void {
  useEffect(() => {
    if (!mapLocation) return undefined;
    const stamp = () => setFix((current) => (current?.at === mapLocation ? current : new FreshFix(mapLocation, Date.now())));
    const timer = window.setTimeout(stamp, 0);
    return () => window.clearTimeout(timer);
  }, [mapLocation, setFix]);
}

// A fix taken without asking when the sheet opens, and again when the one held gets stale; true only while the first
// one is on its way. A stale fix is read again quietly: the actions stay as they were meanwhile, never "Checking…".
function useQuietFix(fix: FreshFix | null, setFix: SetFix, waitFirst: boolean): boolean {
  const { locator } = useServices();
  const [locating, setLocating] = useState(() => waitFirst && locator.canLocateQuietly());
  // Any fix (the map's too) ends the first wait for good.
  if (locating && fix !== null) setLocating(false);
  const settle = useCallback((at: LonLat | null) => {
    if (at) setFix(() => new FreshFix(at, Date.now()));
    setLocating(false);
  }, [setFix]);
  useEffect(() => {
    void locator.locateIfAllowed().then(settle);
  }, [locator, settle]);
  useEffect(() => {
    if (!fix) return undefined;
    const stale = () => {
      setFix((current) => (current === fix ? null : current));
      void locator.locateIfAllowed().then(settle);
    };
    const timer = window.setTimeout(stale, fix.msLeft(Date.now()));
    return () => window.clearTimeout(timer);
  }, [fix, locator, settle, setFix]);
  return locating;
}
