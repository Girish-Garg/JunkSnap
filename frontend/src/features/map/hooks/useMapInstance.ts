import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import { useServices } from '../../../app/useServices';
import { SiteMap, type MapView } from '../SiteMap';

interface MapCallbacks {
  readonly onPick: (siteId: string | null) => void;
  readonly onViewChange: (view: MapView) => void;
  /** MapLibre could not start (for example no WebGL2); the page falls back to a list. */
  readonly onFail: (error: unknown) => void;
}

/** Creates one SiteMap for the container and removes it on unmount. */
export function useMapInstance(container: RefObject<HTMLDivElement | null>, callbacks: MapCallbacks) {
  const { layers, localization } = useServices();
  const mapRef = useRef<SiteMap | null>(null);
  const onPick = useEffectEvent(callbacks.onPick);
  const onViewChange = useEffectEvent(callbacks.onViewChange);
  const onFail = useEffectEvent(callbacks.onFail);
  useEffect(() => {
    if (!container.current) return undefined;
    let map: SiteMap;
    try {
      map = new SiteMap({
        container: container.current,
        layers,
        attributionLabel: localization.i18n.t('map.attribution'),
        onPick: (id) => onPick(id),
        onViewChange: (view) => onViewChange(view),
      });
    } catch (error) {
      onFail(error);
      return undefined;
    }
    mapRef.current = map;
    return () => {
      map.destroy();
      mapRef.current = null;
    };
  }, [container, layers, localization]);
  return mapRef;
}
