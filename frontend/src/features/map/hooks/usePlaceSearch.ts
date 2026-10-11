import { useMemo } from 'react';
import { useConfig } from '../../../app/useConfig';
import { PlaceSearch, type Place } from '../../../domain/PlaceSearch';
import type { SiteFeature } from '../../../domain/Site';
import { useSeatLabels } from './useSeatLabels';

/** Places matching the text: the shipped seat names plus every place named in the loaded sites. */
export function usePlaceSearch(sites: readonly SiteFeature[], query: string): readonly Place[] {
  const seats = useSeatLabels(query.trim().length > 0);
  const { searchResults } = useConfig().limits;
  const search = useMemo(() => new PlaceSearch(sites, seats, searchResults), [sites, seats, searchResults]);
  return useMemo(() => search.find(query), [search, query]);
}
