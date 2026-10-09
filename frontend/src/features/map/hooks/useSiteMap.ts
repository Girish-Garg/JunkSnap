import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import { useServices } from '../../../app/useServices';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import { SiteMap, type MapView } from '../SiteMap';

export interface SiteMapBindings {
  readonly sites: readonly SiteFeature[];
  readonly selectedId: string | null;
  readonly userLocation: LonLat | null;
  readonly onSelect: (siteId: string) => void;
  readonly onViewChange: (view: MapView) => void;
}

export function useSiteMap(container: RefObject<HTMLDivElement | null>, bindings: SiteMapBindings): void {
  const { layers } = useServices();
  const mapRef = useRef<SiteMap | null>(null);
  const onSelect = useEffectEvent(bindings.onSelect);
  const onViewChange = useEffectEvent(bindings.onViewChange);

  useEffect(() => {
    if (!container.current) return undefined;
    const map = new SiteMap({
      container: container.current,
      layers,
      onSelect: (siteId) => onSelect(siteId),
      onViewChange: (view) => onViewChange(view),
    });
    mapRef.current = map;
    return () => {
      map.destroy();
      mapRef.current = null;
    };
  }, [container, layers]);

  useEffect(() => mapRef.current?.showSites(bindings.sites), [bindings.sites]);
  useEffect(() => mapRef.current?.select(bindings.selectedId), [bindings.selectedId]);
  useEffect(() => {
    if (bindings.userLocation) mapRef.current?.showUser(bindings.userLocation);
  }, [bindings.userLocation]);
}
