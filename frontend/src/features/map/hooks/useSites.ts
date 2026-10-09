import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { BBox } from '../../../domain/BBox';
import type { SiteFeature } from '../../../domain/Site';

export interface SitesState {
  readonly sites: readonly SiteFeature[];
  readonly loaded: boolean;
  readonly failed: boolean;
}

const NOT_LOADED: SitesState = { sites: [], loaded: false, failed: false };

/** Keeps the last list on screen while the next one loads. */
export function useSites(bbox: BBox | null): SitesState {
  const { api } = useServices();
  const [state, setState] = useState<SitesState>(NOT_LOADED);
  useEffect(() => {
    if (!bbox) return undefined;
    let current = true;
    api.listSites(bbox).then(
      (sites) => {
        if (current) setState({ sites, loaded: true, failed: false });
      },
      (error: unknown) => {
        console.error('Could not load sites', error);
        if (current) setState((previous) => ({ ...previous, failed: true }));
      },
    );
    return () => {
      current = false;
    };
  }, [api, bbox]);
  return state;
}
