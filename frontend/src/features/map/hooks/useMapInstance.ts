import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import { useServices } from '../../../app/useServices';
import type { BasemapSignal } from '../BasemapWatch';
import type { AreaHit } from '../BoundaryOverlay';
import { SiteMap, type MapView, type SiteMapOptions } from '../SiteMap';

interface MapCallbacks {
  readonly onPick: (siteId: string | null) => void;
  readonly onPickStack: (siteIds: readonly string[]) => void;
  readonly onPickArea: (area: AreaHit) => void;
  readonly onViewChange: (view: MapView) => void;
  /** MapLibre could not start (for example no WebGL2); the page falls back to a list. */
  readonly onFail: (error: unknown) => void;
  readonly onBasemap: (signal: BasemapSignal) => void;
}

function tryCreate(options: SiteMapOptions, onFail: (error: unknown) => void): SiteMap | null {
  try {
    return new SiteMap(options);
  } catch (error) {
    onFail(error);
    return null;
  }
}

/** Puts a new map in `ref`; the cleanup it returns removes that same map. */
function mount(options: SiteMapOptions, onFail: (error: unknown) => void, ref: RefObject<SiteMap | null>): () => void {
  const map = tryCreate(options, onFail);
  ref.current = map;
  return () => {
    map?.destroy();
    ref.current = null;
  };
}

/** Creates one SiteMap for the container and removes it on unmount. */
export function useMapInstance(container: RefObject<HTMLDivElement | null>, callbacks: MapCallbacks) {
  const { layers, localization, boundaries } = useServices();
  const mapRef = useRef<SiteMap | null>(null);
  const onPick = useEffectEvent(callbacks.onPick);
  const onPickStack = useEffectEvent(callbacks.onPickStack);
  const onPickArea = useEffectEvent(callbacks.onPickArea);
  const onViewChange = useEffectEvent(callbacks.onViewChange);
  const onFail = useEffectEvent(callbacks.onFail);
  const onBasemap = useEffectEvent(callbacks.onBasemap);
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
      onBasemap: (signal) => onBasemap(signal),
    };
    return mount(options, (error) => onFail(error), mapRef);
  }, [container, layers, localization, boundaries]);
  return mapRef;
}
