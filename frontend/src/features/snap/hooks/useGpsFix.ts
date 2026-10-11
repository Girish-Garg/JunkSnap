import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { LocationProblem } from '../../../domain/LocationError';
import type { GpsFix } from '../../../domain/ReportUpload';
import { CaptureFixWatch } from '../../../services/CaptureFixWatch';
import { WINDOW_TIMER } from '../../../services/Timer';

export interface GpsState {
  readonly fix: GpsFix | null;
  readonly problem: LocationProblem | null;
  /** When the GPS took the fix, on the services' clock; Scan starts its track from it. */
  readonly takenAtMs?: number;
}

const NONE: GpsState = { fix: null, problem: null };

/**
 * Watches GPS while active; a new fix clears an earlier problem. Each activation starts with no fix, so "Snap again"
 * never reuses the last photo's place; CaptureFixWatch says which arriving fixes count.
 */
export function useGpsFix(active: boolean): GpsState {
  const { snap } = useServices();
  const [state, setState] = useState<GpsState>(NONE);
  useEffect(() => {
    if (!active) return undefined;
    const unwatch = new CaptureFixWatch(snap.gps, WINDOW_TIMER).watch({
      onFix: (fix, takenAtMs) => setState({ fix, problem: null, takenAtMs }),
      onProblem: (problem) => setState((previous) => ({ ...previous, problem })),
    });
    return () => {
      unwatch();
      setState(NONE);
    };
  }, [active, snap.gps]);
  return state;
}
