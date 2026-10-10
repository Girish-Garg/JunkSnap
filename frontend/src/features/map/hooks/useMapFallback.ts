import { useCallback, useState } from 'react';
import { MapSupport } from '../MapSupport';

/** List mode starts without WebGL2 and switches on when the map fails to start or render. */
export function useMapFallback() {
  const [listMode, setListMode] = useState(() => !MapSupport.hasWebGl2());
  const fail = useCallback((error: unknown) => {
    console.error('The map could not start; showing the list instead', error);
    setListMode(true);
  }, []);
  return { listMode, fail };
}
