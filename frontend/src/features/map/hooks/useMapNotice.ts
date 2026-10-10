import type { LocationProblem } from '../../../domain/LocationError';
import type { SiteFeature } from '../../../domain/Site';
import { useOnline } from '../../../ui/useOnline';
import { MapNotice, type MapNoticeView } from '../MapNotice';
import type { SitesLoad } from './useSites';

export interface NoticeSources {
  readonly loaded: SitesLoad;
  /** Sites left after the filters. */
  readonly shown: number;
  readonly partial: boolean;
  readonly locationProblem: LocationProblem | null;
  /** Sites just off an empty view, or null while still looking. */
  readonly nearby: readonly SiteFeature[] | null;
  readonly flash: string | null;
}

/** The one-line toast over the map, from everything the map page knows. */
export function useMapNotice(sources: NoticeSources): MapNoticeView | null {
  const online = useOnline();
  const { loaded, nearby } = sources;
  return MapNotice.pick({
    online,
    failed: loaded.failed,
    locationProblem: sources.locationProblem,
    loaded: loaded.loaded && !loaded.pending,
    loadedCount: loaded.sites.length,
    shownCount: sources.shown,
    clamped: sources.partial,
    truncated: loaded.truncated,
    nearby: nearby === null ? null : nearby.length > 0,
    flash: sources.flash,
  });
}
