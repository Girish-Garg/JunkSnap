import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';

// Redraw only when the heading moves by at least this much, so a shaking hand does not redraw every frame.
const STEP_DEG = 5;

/** The phone's compass heading while active, rounded to 5 degrees; null without a compass. */
export function useCompassHeading(active: boolean): number | null {
  const { snap } = useServices();
  const [heading, setHeading] = useState<number | null>(null);
  useEffect(() => {
    if (!active || !snap.compass) return undefined;
    return snap.compass.watch((degrees) => setHeading((Math.round(degrees / STEP_DEG) * STEP_DEG) % 360));
  }, [active, snap.compass]);
  return active ? heading : null;
}
