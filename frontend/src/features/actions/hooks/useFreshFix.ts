import { useCallback, useEffect, useState } from 'react';
import { useConfig } from '../../../app/useConfig';
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
type FromMap = (at: LonLat | null) => FreshFix | null;

/**
 * The person's location for distance gates: the map's fix (as old as it really is) or a fresh one taken when the
 * sheet opens or the fix gets stale, only if location is already allowed so opening a sheet never prompts. A fix is
 * fresh for capture.freshFixMs.
 */
export function useFreshFix(mapLocation: LonLat | null): FreshLocation {
  const fromMap = useFromMap();
  const [fix, setFix] = useState<FreshFix | null>(() => fromMap(mapLocation));
  useMapFix(mapLocation, fromMap, setFix);
  // Only the first render's value counts: wait for a quiet fix when the sheet opens without a fresh one.
  const locating = useQuietFix(fix, setFix, fix === null);
  const { relocate, asking } = useTapFix(setFix);
  return { fix, locating: (locating || asking) && fix === null, relocate };
}

// The map's fix aged from when the app got it (GeoLocator knows; a point it did not hand out counts from now). A fix
// from app start may be long stale when a sheet opens: then there is none, and a tap takes a fresh one.
function useFromMap(): FromMap {
  const { locator } = useServices();
  const { freshFixMs } = useConfig().capture;
  return useCallback(
    (at: LonLat | null) => {
      if (!at) return null;
      const now = Date.now();
      const fix = new FreshFix(at, locator.takenMs(at) ?? now, freshFixMs);
      return fix.isFresh(now) ? fix : null;
    },
    [locator, freshFixMs],
  );
}

// A fix a tap asked for: it may show the location prompt, and the distance actions wait while it comes. Each answer
// tells LocationAccess whether location is allowed, so the tiles say so.
function useTapFix(setFix: SetFix): { readonly relocate: FreshLocation['relocate']; readonly asking: boolean } {
  const { locator, locationAccess } = useServices();
  const { freshFixMs } = useConfig().capture;
  const [asking, setAsking] = useState(false);
  const relocate = useCallback(async () => {
    setAsking(true);
    try {
      const fresh = new FreshFix(await locator.locate(), Date.now(), freshFixMs);
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
  }, [locator, locationAccess, setFix, freshFixMs]);
  return { relocate, asking };
}

// The map's fix, at its real age: at once on the first render, later ones on the next tick. A stale one changes nothing.
function useMapFix(mapLocation: LonLat | null, fromMap: FromMap, setFix: SetFix): void {
  useEffect(() => {
    if (!mapLocation) return undefined;
    const take = () => setFix((current) => (current?.at === mapLocation ? current : (fromMap(mapLocation) ?? current)));
    const timer = window.setTimeout(take, 0);
    return () => window.clearTimeout(timer);
  }, [mapLocation, fromMap, setFix]);
}

// A fix taken without asking when the sheet opens, and again when the one held gets stale; true only while the first
// one is on its way. A stale fix is read again quietly: the actions stay as they were meanwhile, never "Checking…".
function useQuietFix(fix: FreshFix | null, setFix: SetFix, waitFirst: boolean): boolean {
  const { locator } = useServices();
  const { freshFixMs } = useConfig().capture;
  const [locating, setLocating] = useState(() => waitFirst && locator.canLocateQuietly());
  // Any fix (the map's too) ends the first wait for good.
  if (locating && fix !== null) setLocating(false);
  const settle = useCallback((at: LonLat | null) => {
    if (at) setFix(() => new FreshFix(at, Date.now(), freshFixMs));
    setLocating(false);
  }, [setFix, freshFixMs]);
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
