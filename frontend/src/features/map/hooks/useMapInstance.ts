import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import { useServices } from '../../../app/useServices';
import type { AreaHit } from '../BoundaryOverlay';
import { SiteMap, type MapView, type SiteMapOptions } from '../SiteMap';

interface MapCallbacks {
  readonly onPick: (siteId: string | null) => void;
  readonly onPickStack: (siteIds: readonly string[]) => void;
  readonly onPickArea: (area: AreaHit) => void;
  readonly onViewChange: (view: MapView) => void;
  /** MapLibre could not start (for example no WebGL2); the page falls back to a list. */
  readonly onFail: (error: unknown) => void;
}

function tryCreate(options: SiteMapOptions, onFail: (error: unknown) => void): SiteMap | null {
  try {
    return new SiteMap(options);
  } catch (error) {
    onFail(error);
    return null;
  }
}

/** Creates one SiteMap for the container and removes it on unmount. */
export function useMapInstance(container: RefObject<HTMLDivElement | null>, callbacks: MapCallbacks) {
  const { layers, localization, boundaries, config } = useServices();
  const mapRef = useRef<SiteMap | null>(null);
  const onPick = useEffectEvent(callbacks.onPick);
  const onPickStack = useEffectEvent(callbacks.onPickStack);
  const onPickArea = useEffectEvent(callbacks.onPickArea);
  const onViewChange = useEffectEvent(callbacks.onViewChange);
  const onFail = useEffectEvent(callbacks.onFail);
  useEffect(() => {
    if (!container.current) return undefined;
    const options: SiteMapOptions = {
      container: container.current,
      layers,
      boundaries,
      attributionLabel: localization.i18n.t('map.attribution'),
      onPick: (id) => onPick(id),
      onPickStack: (ids) => onPickStack(ids),
      onPickArea: (area) => onPickArea(area),
      onViewChange: (view) => onViewChange(view),
      settings: config.map,
    };
    const map = tryCreate(options, (error) => onFail(error));
    mapRef.current = map;
    return () => {
      map?.destroy();
      mapRef.current = null;
    };
  }, [container, layers, localization, boundaries, config]);
  return mapRef;
}
