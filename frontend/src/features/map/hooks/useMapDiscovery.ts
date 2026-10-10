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
  /** The person's own location fix, which the opening view never overrides. */
  readonly located: boolean;
  /** The last camera move the app asked for (a search, a deep link, a location fix). */
  readonly camera: CameraRequest | null;
  readonly frame: (points: readonly LonLat[]) => void;
}

/** True once the opening view should stay as it is: the person moved, located, searched or already sees sites. */
function settles({ view, found, located, camera }: DiscoveryInput): boolean {
  return Boolean(view?.byUser) || found || located || camera !== null;
}

/**
 * The nearest sites when the view is empty, and the opening move: if the first view loads empty and nothing
 * else has moved the map, it widens once to take in the nearest sites, so the map never opens on a blank city.
 */
export function useMapDiscovery(input: DiscoveryInput): readonly SiteFeature[] | null {
  const nearby = useNearbySites(input.view, input.empty);
  const settled = useRef(false);
  const shouldSettle = settles(input);
  const { view, frame } = input;
  useEffect(() => {
    if (shouldSettle) settled.current = true;
  }, [shouldSettle]);
  useEffect(() => {
    if (settled.current || !view || !nearby || nearby.length === 0) return;
    settled.current = true;
    frame(NearestSites.frame(view.bbox, nearby));
  }, [view, nearby, frame]);
  return nearby;
}
