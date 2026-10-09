import { useCallback, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { LocationError, type LocationProblem } from '../../../domain/LocationError';
import type { LonLat } from '../../../domain/Site';

export interface LocateState {
  readonly position: LonLat | null;
  readonly problem: LocationProblem | null;
  readonly locate: () => void;
}

export function useLocate(): LocateState {
  const { locator } = useServices();
  const [position, setPosition] = useState<LonLat | null>(null);
  const [problem, setProblem] = useState<LocationProblem | null>(null);
  const locate = useCallback(() => {
    locator.locate().then(
      (found) => {
        setProblem(null);
        setPosition(found);
      },
      (error: unknown) => setProblem(error instanceof LocationError ? error.problem : 'unavailable'),
    );
  }, [locator]);
  return { position, problem, locate };
}
