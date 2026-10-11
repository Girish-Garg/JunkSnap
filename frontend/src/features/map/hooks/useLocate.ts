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

type SetPosition = (position: LonLat) => void;

/**
 * The person's location. On open it reads a fix only if location is already allowed, and takes the start-up fix
 * (StartupLocation). It never moves the map with either: the map opens on the pilot city, and the page
 * offers "Go to my location" instead.
 */
export function useLocate(): LocateState {
  const { locator, startupLocation } = useServices();
  const [position, setPosition] = useState<LonLat | null>(() => startupLocation.fix());
  const [problem, setProblem] = useState<LocationProblem | null>(null);
  useQuietFix(setPosition);
  useStartupFix(setPosition);
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

// A fix read without asking, only when location is already allowed.
function useQuietFix(setPosition: SetPosition): void {
  const { locator } = useServices();
  useEffect(() => {
    let current = true;
    void locator.locateIfAllowed().then((found) => {
      if (current && found) setPosition(found);
    });
    return () => {
      current = false;
    };
  }, [locator, setPosition]);
}

// The start-up fix, when it comes after the map opened. A denial there sets no problem: the map says nothing.
function useStartupFix(setPosition: SetPosition): void {
  const { startupLocation } = useServices();
  useEffect(
    () =>
      startupLocation.subscribe(() => {
        const found = startupLocation.fix();
        if (found) setPosition(found);
      }),
    [startupLocation, setPosition],
  );
}
