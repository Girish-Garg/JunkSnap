import { useEffect, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../app/useTheme';
import type { MapMode } from '../../../domain/MapMode';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { AreaMarker } from '../AreaMarkers';
import type { AreaHit, BoundaryView } from '../BoundaryOverlay';
import type { CameraRequest } from '../CameraRequest';
import type { MapView } from '../SiteMap';
import { useMapInstance } from './useMapInstance';

export interface SiteMapBindings {
  readonly sites: readonly SiteFeature[];
  readonly selectedId: string | null;
  readonly mode: MapMode;
  readonly userLocation: LonLat | null;
  readonly camera: CameraRequest | null;
  /** How to draw the map's areas, or null while there are none. */
  readonly areas: BoundaryView | null;
  /** Area id to the value its marker shows under its name. */
  readonly areaMarkers: ReadonlyMap<string, AreaMarker>;
  /** Area id to fill colour. */
  readonly areaColors: ReadonlyMap<string, string>;
  readonly onPick: (siteId: string | null) => void;
  /** A tap on one pin standing for several sites at one spot. */
  readonly onPickStack: (siteIds: readonly string[]) => void;
  readonly onPickArea: (area: AreaHit) => void;
  readonly onViewChange: (view: MapView) => void;
  readonly onFail: (error: unknown) => void;
}

/** Keeps the imperative SiteMap in step with React state. */
export function useSiteMap(container: RefObject<HTMLDivElement | null>, bindings: SiteMapBindings): void {
  const { t } = useTranslation();
  const mapRef = useMapInstance(container, bindings);
  const { dark } = useTheme();
  useEffect(() => mapRef.current?.setDark(dark), [mapRef, dark]);
  useEffect(() => mapRef.current?.showSites(bindings.sites), [mapRef, bindings.sites]);
  useEffect(() => mapRef.current?.select(bindings.selectedId), [mapRef, bindings.selectedId]);
  useEffect(() => mapRef.current?.setMode(bindings.mode), [mapRef, bindings.mode]);
  useEffect(() => mapRef.current?.showBoundaries(bindings.areas), [mapRef, bindings.areas]);
  useEffect(() => mapRef.current?.labelAreas(bindings.areaMarkers), [mapRef, bindings.areaMarkers]);
  useEffect(() => mapRef.current?.paintAreas(bindings.areaColors), [mapRef, bindings.areaColors]);
  useEffect(() => mapRef.current?.moveTo(bindings.camera?.points ?? [], bindings.camera?.zoom), [mapRef, bindings.camera]);
  useEffect(() => mapRef.current?.setAttributionLabel(t('map.attribution')), [mapRef, t]);
  useEffect(() => {
    if (bindings.userLocation) mapRef.current?.showUser(bindings.userLocation);
  }, [mapRef, bindings.userLocation]);
}
