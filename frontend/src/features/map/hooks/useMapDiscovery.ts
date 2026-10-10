import { useEffect, useRef } from 'react';
import { NearestSites } from '../../../domain/NearestSites';
import type { LonLat, SiteFeature } from '../../../domain/Site';
import type { CameraRequest } from '../CameraRequest';
import type { MapView } from '../SiteMap';
import { useNearbySites } from './useNearbySites';

export interface DiscoveryInput {
  readonly view: MapView | null;
  /** This view finished loading with no site in it. */
  readonly empty: boolean;
  /** This view finished loading with sites in it. */
  readonly found: boolean;
  /** The app opened on a site's own link, which always wins over the opening view. */
  readonly deepLinked: boolean;
  /** The last camera move the app asked for (a search, a deep link, "Go to my location"). */
  readonly camera: CameraRequest | null;
  /** Every site of the pilot city, or null while it loads. */
  readonly pilot: readonly SiteFeature[] | null;
  readonly frame: (points: readonly LonLat[]) => void;
}

/** True once the opening view should stay as it is: the person moved, searched, followed a link or already sees sites. */
function settles({ view, found, deepLinked, camera }: DiscoveryInput): boolean {
  return Boolean(view?.byUser) || found || deepLinked || camera !== null;
}

/**
 * The nearest sites when the view is empty, and the opening move. The map opens on the pilot city; if that
 * first view loads empty and nothing else has moved the map, it fits the city's sites once, so judges and
 * first-time visitors never open on a blank map and never get taken out of Jodhpur. A location fix alone
 * never moves it.
 */
export function useMapDiscovery(input: DiscoveryInput): readonly SiteFeature[] | null {
  const nearby = useNearbySites(input.view, input.empty);
  const settled = useRef(false);
  const shouldSettle = settles(input);
  const { view, empty, pilot, frame } = input;
  useEffect(() => {
    if (shouldSettle) settled.current = true;
  }, [shouldSettle]);
  useEffect(() => {
    if (settled.current || !view || !empty || !pilot || pilot.length === 0) return;
    settled.current = true;
    frame(NearestSites.frame(view.bbox, pilot));
  }, [view, empty, pilot, frame]);
  return nearby;
}
