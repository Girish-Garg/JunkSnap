import { useEffect, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoundaryKind } from '../../../domain/AreaListing';
import type { MapMode } from '../../../domain/MapMode';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { AreaMarker } from '../AreaMarkers';
import type { AreaHit } from '../BoundaryOverlay';
import type { CameraRequest } from '../CameraRequest';
import type { MapView } from '../SiteMap';
import { useMapInstance } from './useMapInstance';

export interface SiteMapBindings {
  readonly sites: readonly SiteFeature[];
  readonly selectedId: string | null;
  readonly mode: MapMode;
  readonly userLocation: LonLat | null;
  readonly camera: CameraRequest | null;
  readonly boundary: BoundaryKind | null;
  /** The kind has an original-edge file for close zooms. */
  readonly boundaryFine: boolean;
  /** The boundary layer's own credit line, if it has one. */
  readonly boundaryCredit?: string;
  /** Area id to the value its marker shows under its name. */
  readonly areaMarkers: ReadonlyMap<string, AreaMarker>;
  /** Area id to fill colour for the boundary kind shown. */
  readonly areaColors: ReadonlyMap<string, string>;
  readonly onPick: (siteId: string | null) => void;
  readonly onPickArea: (area: AreaHit) => void;
  readonly onViewChange: (view: MapView) => void;
  readonly onFail: (error: unknown) => void;
}

/** Keeps the imperative SiteMap in step with React state. */
export function useSiteMap(container: RefObject<HTMLDivElement | null>, bindings: SiteMapBindings): void {
  const { t } = useTranslation();
  const mapRef = useMapInstance(container, bindings);
  useEffect(() => mapRef.current?.showSites(bindings.sites), [mapRef, bindings.sites]);
  useEffect(() => mapRef.current?.select(bindings.selectedId), [mapRef, bindings.selectedId]);
  useEffect(() => mapRef.current?.setMode(bindings.mode), [mapRef, bindings.mode]);
  const { boundary, boundaryFine, boundaryCredit } = bindings;
  useEffect(
    () => mapRef.current?.showBoundaries(boundary && { kind: boundary, fine: boundaryFine, attribution: boundaryCredit }),
    [mapRef, boundary, boundaryFine, boundaryCredit],
  );
  useEffect(() => mapRef.current?.labelAreas(bindings.areaMarkers), [mapRef, bindings.areaMarkers]);
  useEffect(() => mapRef.current?.paintAreas(bindings.areaColors), [mapRef, bindings.areaColors]);
  useEffect(() => mapRef.current?.moveTo(bindings.camera?.points ?? []), [mapRef, bindings.camera]);
  useEffect(() => mapRef.current?.setAttributionLabel(t('map.attribution')), [mapRef, t]);
  useEffect(() => {
    if (bindings.userLocation) mapRef.current?.showUser(bindings.userLocation);
  }, [mapRef, bindings.userLocation]);
}
