import { useMemo } from 'react';
import { AreaKey } from '../../../domain/AreaKey';
import type { AreaScores } from '../../../domain/AreaScores';
import { useMapContext } from '../../map/useMapContext';

/** The area's district from the sites already loaded on the map; no extra request. */
export function useAreaDistrict(area: AreaScores['area']): string | null {
  const { sites } = useMapContext();
  return useMemo(() => new AreaKey(area.kind, area.id, area.name).districtIn(sites), [area, sites]);
}
