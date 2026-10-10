import { useCallback, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { MapSupport } from '../MapSupport';

/** List mode starts without WebGL2 and switches on when the map fails to start or render. */
export function useMapFallback() {
  const { errors } = useServices();
  const [listMode, setListMode] = useState(() => !MapSupport.hasWebGl2());
  // The map could not start or crashed while drawing: the list takes over.
  const fail = useCallback(
    (error: unknown) => {
      errors.report('map', error);
      setListMode(true);
    },
    [errors],
  );
  return { listMode, fail };
}
