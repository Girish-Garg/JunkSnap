import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { LocationError, type LocationProblem } from '../../../domain/LocationError';
import type { LonLat } from '../../../domain/Site';

export interface LocateState {
  readonly position: LonLat | null;
  readonly problem: LocationProblem | null;
  /** Asks for a fix (the browser may prompt); resolves with it, or null when there is none. */
  readonly locate: () => Promise<LonLat | null>;
}

/**
 * The person's location. On open it reads a fix only if location is already allowed, and never moves the map
 * with it: the map opens on the pilot city, and the page offers "Go to my location" instead.
 */
export function useLocate(): LocateState {
  const { locator } = useServices();
  const [position, setPosition] = useState<LonLat | null>(null);
  const [problem, setProblem] = useState<LocationProblem | null>(null);
  useEffect(() => {
    let current = true;
    void locator.locateIfAllowed().then((found) => {
      if (current && found) setPosition(found);
    });
    return () => {
      current = false;
    };
  }, [locator]);
  const locate = useCallback(
    () =>
      locator.locate().then(
        (found) => {
          setProblem(null);
          setPosition(found);
          return found;
        },
        (error: unknown) => {
          setProblem(error instanceof LocationError ? error.problem : 'unavailable');
          return null;
        },
      ),
    [locator],
  );
  return { position, problem, locate };
}
