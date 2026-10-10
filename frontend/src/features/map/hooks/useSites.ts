import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { BBox } from '../../../domain/BBox';
import type { SiteFeature } from '../../../domain/Site';

export interface SitesState {
  readonly sites: readonly SiteFeature[];
  readonly loaded: boolean;
  readonly failed: boolean;
}

export interface SitesLoad extends SitesState {
  /** Fetches the same box again, so withdrawn, rejected and cleared sites leave the map without a reload. */
  readonly refresh: () => void;
}

const NOT_LOADED: SitesState = { sites: [], loaded: false, failed: false };

/** Keeps the last list on screen while the next one loads. */
export function useSites(bbox: BBox | null): SitesLoad {
  const { api } = useServices();
  const [state, setState] = useState<SitesState>(NOT_LOADED);
  const [version, setVersion] = useState(0);
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
  }, [api, bbox, version]);
  const refresh = useCallback(() => setVersion((count) => count + 1), []);
  return { ...state, refresh };
}
