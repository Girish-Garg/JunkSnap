import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { cityById, isBoundaryKind, type BoundaryKind, type City } from '../../../domain/AreaListing';

const DEFAULT_KIND: BoundaryKind = 'assembly';

/** City and area kind live in the URL (?city=&kind=), so a ranking can be shared; Jodhpur by default. */
export function useRankingQuery() {
  const [params, setParams] = useSearchParams();
  const city: City = cityById(params.get('city'));
  const rawKind = params.get('kind') ?? '';
  const kind: BoundaryKind = isBoundaryKind(rawKind) ? rawKind : DEFAULT_KIND;
  const update = useCallback(
    (next: { readonly city?: string; readonly kind?: BoundaryKind }) =>
      setParams({ city: next.city ?? city.id, kind: next.kind ?? kind }, { replace: true }),
    [setParams, city.id, kind],
  );
  return { city, kind, update };
}
