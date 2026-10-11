import { useBasemapStatus } from './useBasemapStatus';
import { useMapFallback } from './useMapFallback';

/**
 * How the map surface is doing: list mode when the map cannot draw, else how far its basemap has got (the list
 * has none to wait for), with the callbacks MapSurface reports both through.
 */
export function useMapSurface() {
  const { listMode, fail } = useMapFallback();
  const basemap = useBasemapStatus();
  const phase = listMode ? 'idle' : basemap.phase;
  return { listMode, phase, retryMap: basemap.retry, bindings: { onFail: fail, ...basemap.bindings } };
}
