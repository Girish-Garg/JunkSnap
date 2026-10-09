import { useMemo } from 'react';
import { PlaceSearch, type Place } from '../../../domain/PlaceSearch';
import type { SiteFeature } from '../../../domain/Site';

export function usePlaceSearch(sites: readonly SiteFeature[], query: string): readonly Place[] {
  const search = useMemo(() => new PlaceSearch(sites), [sites]);
  return useMemo(() => search.find(query), [search, query]);
}
