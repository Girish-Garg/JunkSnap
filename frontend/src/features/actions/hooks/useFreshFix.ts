import { useCallback, useEffect, useState } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import { FreshFix } from '../../../domain/FreshFix';
import type { LonLat } from '../../../domain/Site';

export interface FreshLocation {
  /** A fix under 2 minutes old, or null; it turns null by itself when it gets stale. */
  readonly fix: FreshFix | null;
  /** No fix yet since the sheet opened, but one is on its way without asking (location is allowed). */
  readonly locating: boolean;
  /** Takes a fresh fix; null when the browser gives none. */
  readonly relocate: () => Promise<FreshFix | null>;
}

type SetFix = (change: (current: FreshFix | null) => FreshFix | null) => void;

/**
 * The person's location for distance gates: the map's fix (as old as its last change) or a fresh one taken when the
 * sheet opens or the fix gets stale, only if location is already allowed so opening a sheet never prompts. A fix is
 * fresh for capture.freshFixMs.
 */
export function useFreshFix(mapLocation: LonLat | null): FreshLocation {
  const { locator } = useServices();
  const { freshFixMs } = useConfig().capture;
  const [fix, setFix] = useState<FreshFix | null>(() => (mapLocation ? new FreshFix(mapLocation, Date.now(), freshFixMs) : null));
  useMapFix(mapLocation, setFix);
  const locating = useQuietFix(fix, setFix, mapLocation === null);
  const relocate = useCallback(
    () => locator.locate().then((at) => {
      const fresh = new FreshFix(at, Date.now(), freshFixMs);
      setFix(() => fresh);
      return fresh;
    }, () => null),
    [locator, freshFixMs],
  );
  return { fix, locating: locating && fix === null, relocate };
}

// The map's fix counts from when it arrived here: at once on the first render, later ones on the next tick.
function useMapFix(mapLocation: LonLat | null, setFix: SetFix): void {
  const { freshFixMs } = useConfig().capture;
  useEffect(() => {
    if (!mapLocation) return undefined;
    const stamp = () => setFix((current) => (current?.at === mapLocation ? current : new FreshFix(mapLocation, Date.now(), freshFixMs)));
    const timer = window.setTimeout(stamp, 0);
    return () => window.clearTimeout(timer);
  }, [mapLocation, setFix, freshFixMs]);
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
