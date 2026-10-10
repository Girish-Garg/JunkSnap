import { useEffect, useMemo, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { BBox } from '../../../domain/BBox';
import { NearestSites } from '../../../domain/NearestSites';
import type { SiteFeature } from '../../../domain/Site';
import type { MapView } from '../SiteMap';

interface Found {
  readonly view: MapView;
  readonly sites: readonly SiteFeature[];
  readonly failed: boolean;
}

/** The one GET /sites around an empty view: its box, and its sites (null while in flight). Shared with the pilot city. */
export interface AroundSites {
  readonly box: BBox;
  readonly sites: readonly SiteFeature[] | null;
  readonly failed: boolean;
}

export interface NearbySites {
  /** The nearest sites just off screen, or null while still looking. */
  readonly nearest: readonly SiteFeature[] | null;
  readonly around: AroundSites | null;
}

const NONE: readonly SiteFeature[] = [];
const NOTHING_TO_SEARCH: NearbySites = { nearest: NONE, around: null };

function aroundOf(box: BBox, mine: Found | null): AroundSites {
  return { box, sites: mine?.sites ?? null, failed: mine?.failed ?? false };
}

/**
 * For a view that loaded no sites: the nearest sites just off screen, from one GET /sites around its centre.
 * null while still looking, so "No reports here yet" never shows before the search around it is done.
 */
export function useNearbySites(view: MapView | null, empty: boolean): NearbySites {
  const { api } = useServices();
  const [found, setFound] = useState<Found | null>(null);
  const reach = useMemo(() => (view && empty ? NearestSites.reach(view.bbox) : null), [view, empty]);
  useEffect(() => {
    if (!view || !reach) return undefined;
    let current = true;
    api.listSites(reach).then(
      (sites) => current && setFound({ view, sites, failed: false }),
      (error: unknown) => {
        console.error('Could not look for sites near the view', error);
        if (current) setFound({ view, sites: NONE, failed: true });
      },
    );
    return () => {
      current = false;
    };
  }, [api, view, reach]);
  const mine = found && found.view === view ? found : null;
  const nearest = useMemo(() => (mine ? NearestSites.of(mine.sites, mine.view.bbox.center()) : null), [mine]);
  return reach ? { nearest, around: aroundOf(reach, mine) } : NOTHING_TO_SEARCH;
}
