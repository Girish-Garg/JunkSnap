import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import { PilotCity } from '../../../domain/PilotCity';
import type { SiteFeature } from '../../../domain/Site';

const NONE: readonly SiteFeature[] = [];

/**
 * Every site of the pilot city, from one GET /sites over its bounds, loaded the first time it is `wanted`
 * (an empty opening view, or the list over an empty view) and kept. null while loading or not yet wanted.
 */
export function usePilotSites(wanted: boolean): readonly SiteFeature[] | null {
  const { api } = useServices();
  const [sites, setSites] = useState<readonly SiteFeature[] | null>(null);
  const [asked, setAsked] = useState(false);
  if (wanted && !asked) setAsked(true);
  useEffect(() => {
    if (!asked) return undefined;
    let current = true;
    api.listSites(PilotCity.bounds).then(
      (found) => current && setSites(PilotCity.sitesOf(found)),
      (error: unknown) => {
        console.error('Could not load the pilot city sites', error);
        if (current) setSites(NONE);
      },
    );
    return () => {
      current = false;
    };
  }, [api, asked]);
  return sites;
}
