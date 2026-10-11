import { useMemo } from 'react';
import { useConfig } from '../../../app/useConfig';
import type { SiteFilter } from '../../../domain/SiteFilter';
import { SiteTiles } from '../../../domain/SiteTiles';
import { ViewCounts } from '../../../domain/ViewCounts';
import type { MapView } from '../SiteMap';
import { useSites } from './useSites';

/** What the Filters counts cover: the whole view, only its middle (too wide to load), or the newest 500 per query. */
export type CountScope = 'view' | 'middle' | 'capped';

/** Counts show only once this view's sites are in: never the last view's numbers, never zeros after a failed load. */
export type CountStatus = 'ready' | 'loading' | 'failed';

export interface FilterCounts {
  readonly counts: ViewCounts;
  readonly scope: CountScope;
  readonly status: CountStatus;
}

/** The sites of the current view: loaded by tiles, filtered for the map, counted for the Filters sheet on every move. */
export function useSiteData(view: MapView | null, filter: SiteFilter) {
  const { map } = useConfig();
  const plan = useMemo(() => (view ? SiteTiles.plan(view.bbox, map) : null), [view, map]);
  const loaded = useSites(plan);
  const sites = useMemo(() => filter.apply(loaded.sites), [filter, loaded.sites]);
  const counts = useMemo((): FilterCounts | null => {
    if (!plan) return null;
    const scope: CountScope = plan.partial ? 'middle' : loaded.truncated ? 'capped' : 'view';
    const status: CountStatus = loaded.failed ? 'failed' : loaded.pending || !loaded.loaded ? 'loading' : 'ready';
    return { counts: ViewCounts.of(loaded.sites, plan.view, filter), scope, status };
  }, [plan, loaded.sites, loaded.truncated, loaded.pending, loaded.loaded, loaded.failed, filter]);
  return { loaded, sites, counts, partial: plan?.partial ?? false };
}
