import { useEffect, useEffectEvent, useRef, type RefObject } from 'react';
import { useServices } from '../../../app/useServices';
import type { MapMode } from '../../../domain/MapMode';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { CameraRequest } from '../CameraRequest';
import { SiteMap, type MapView } from '../SiteMap';

export interface SiteMapBindings {
  readonly sites: readonly SiteFeature[];
  readonly selectedId: string | null;
  readonly mode: MapMode;
  readonly userLocation: LonLat | null;
  readonly camera: CameraRequest | null;
  readonly onPick: (siteId: string | null) => void;
  readonly onViewChange: (view: MapView) => void;
}

export function useSiteMap(container: RefObject<HTMLDivElement | null>, bindings: SiteMapBindings): void {
  const { layers, localization } = useServices();
  const mapRef = useRef<SiteMap | null>(null);
  const onPick = useEffectEvent(bindings.onPick);
  const onViewChange = useEffectEvent(bindings.onViewChange);
  useEffect(() => {
    if (!container.current) return undefined;
    const map = new SiteMap({
      container: container.current,
      layers,
      attributionLabel: localization.i18n.t('map.attribution'),
      onPick: (id) => onPick(id),
      onViewChange: (view) => onViewChange(view),
    });
    mapRef.current = map;
    return () => {
      map.destroy();
      mapRef.current = null;
    };
  }, [container, layers, localization]);
  useEffect(() => mapRef.current?.showSites(bindings.sites), [bindings.sites]);
  useEffect(() => mapRef.current?.select(bindings.selectedId), [bindings.selectedId]);
  useEffect(() => mapRef.current?.setMode(bindings.mode), [bindings.mode]);
  useEffect(() => mapRef.current?.moveTo(bindings.camera?.points ?? []), [bindings.camera]);
  useEffect(() => {
    if (bindings.userLocation) mapRef.current?.showUser(bindings.userLocation);
  }, [bindings.userLocation]);
}
