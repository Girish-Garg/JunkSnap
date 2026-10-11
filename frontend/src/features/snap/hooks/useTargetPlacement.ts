import { useState } from 'react';
import { useConfig } from '../../../app/useConfig';
import type { LatLon } from '../../../domain/ReportUpload';
import { TargetPlacement } from '../../../domain/TargetPlacement';

/**
 * The place step: "right here" by default, so the normal flow costs no tap; "farther away" lets the reporter
 * drag the pin or tap the map. Leaving "farther away" forgets the pin.
 */
export function useTargetPlacement(origin: LatLon) {
  const { site: reach } = useConfig();
  const [placement, setPlacement] = useState(() => TargetPlacement.here(origin, reach));
  const [far, setFar] = useState(false);
  return {
    far,
    placement,
    /** What goes in report_upload.target; null while the waste is right here. */
    target: far ? placement.target : null,
    chooseFar: (next: boolean) => {
      setFar(next);
      if (!next) setPlacement((current) => current.reset());
    },
    moveTo: (point: LatLon) => setPlacement((current) => current.moveTo(point)),
    setHigh: (high: boolean) => setPlacement((current) => current.withHighView(high)),
  };
}

export type TargetPlace = ReturnType<typeof useTargetPlacement>;
