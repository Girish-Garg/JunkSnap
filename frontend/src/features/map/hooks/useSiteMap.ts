import { useEffect, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { MapMode } from '../../../domain/MapMode';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { CameraRequest } from '../CameraRequest';
import type { MapView } from '../SiteMap';
import { useMapInstance } from './useMapInstance';

export interface SiteMapBindings {
  readonly sites: readonly SiteFeature[];
  readonly selectedId: string | null;
  readonly mode: MapMode;
  readonly userLocation: LonLat | null;
  readonly camera: CameraRequest | null;
  readonly onPick: (siteId: string | null) => void;
  readonly onViewChange: (view: MapView) => void;
}

/** Keeps the imperative SiteMap in step with React state. */
export function useSiteMap(container: RefObject<HTMLDivElement | null>, bindings: SiteMapBindings): void {
  const { t } = useTranslation();
  const mapRef = useMapInstance(container, bindings);
  useEffect(() => mapRef.current?.showSites(bindings.sites), [mapRef, bindings.sites]);
  useEffect(() => mapRef.current?.select(bindings.selectedId), [mapRef, bindings.selectedId]);
  useEffect(() => mapRef.current?.setMode(bindings.mode), [mapRef, bindings.mode]);
  useEffect(() => mapRef.current?.moveTo(bindings.camera?.points ?? []), [mapRef, bindings.camera]);
  useEffect(() => mapRef.current?.setAttributionLabel(t('map.attribution')), [mapRef, t]);
  useEffect(() => {
    if (bindings.userLocation) mapRef.current?.showUser(bindings.userLocation);
  }, [mapRef, bindings.userLocation]);
}
