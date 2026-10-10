import { useEffect, useMemo, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { NearestSites } from '../../../domain/NearestSites';
import type { SiteFeature } from '../../../domain/Site';
import type { MapView } from '../SiteMap';

interface Found {
  readonly view: MapView;
  readonly sites: readonly SiteFeature[];
}

const NONE: readonly SiteFeature[] = [];

/**
 * For a view that loaded no sites: the nearest sites just off screen, from one GET /sites around its centre.
 * null while still looking, so "No reports here yet" never shows before the search around it is done.
 */
export function useNearbySites(view: MapView | null, empty: boolean): readonly SiteFeature[] | null {
  const { api } = useServices();
  const [found, setFound] = useState<Found | null>(null);
  const reach = useMemo(() => (view && empty ? NearestSites.reach(view.bbox) : null), [view, empty]);
  useEffect(() => {
    if (!view || !reach) return undefined;
    let current = true;
    const keep = (sites: readonly SiteFeature[]) => current && setFound({ view, sites });
    api.listSites(reach).then(
      (sites) => keep(NearestSites.of(sites, view.bbox.center())),
      (error: unknown) => {
        console.error('Could not look for sites near the view', error);
        keep(NONE);
      },
    );
    return () => {
      current = false;
    };
  }, [api, view, reach]);
  if (!view || !empty || !reach) return NONE;
  return found?.view === view ? found.sites : null;
}
