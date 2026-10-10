import { useMemo } from 'react';
import { AreaKey } from '../../../domain/AreaKey';
import type { SiteFeature } from '../../../domain/Site';
import { useMapContext } from '../../map/useMapContext';

export interface AreaEntry {
  readonly area: AreaKey;
  readonly sites: number;
}

/** Areas that hold the sites loaded on the map, with how many of those sites each holds, matching the search text. */
export function useAreaDirectory(query: string): readonly AreaEntry[] {
  const { sites } = useMapContext();
  const entries = useMemo(() => AreaKey.fromSites(sites).map((area) => ({ area, sites: count(area, sites) })), [sites]);
  const needle = query.trim().toLocaleLowerCase();
  return needle ? entries.filter((entry) => entry.area.name.toLocaleLowerCase().includes(needle)) : entries;
}

function count(area: AreaKey, sites: readonly SiteFeature[]): number {
  return sites.filter((site) => area.holds(site)).length;
}
