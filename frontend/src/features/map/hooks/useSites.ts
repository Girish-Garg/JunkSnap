import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { SiteBatch, SiteTiles } from '../../../domain/SiteTiles';

interface SitesState extends SiteBatch {
  readonly loaded: boolean;
  /** The plan these sites were loaded for; another one means the next load is still on its way. */
  readonly plan: SiteTiles | null;
  /** The plan whose last load failed. */
  readonly failedPlan: SiteTiles | null;
}

export interface SitesLoad extends SiteBatch {
  readonly loaded: boolean;
  /** The last load of this view failed; a new view starts clean. */
  readonly failed: boolean;
  /** True while the sites on screen belong to an earlier view. */
  readonly pending: boolean;
  /** Fetches the same view again, so withdrawn, rejected and cleared sites leave the map without a reload. */
  readonly refresh: () => void;
}

const NOT_LOADED: SitesState = { sites: [], truncated: false, loaded: false, plan: null, failedPlan: null };

/** One GET /sites per tile of the view, merged. Keeps the last list on screen while the next one loads. */
export function useSites(plan: SiteTiles | null): SitesLoad {
  const { api, errors } = useServices();
  const [state, setState] = useState<SitesState>(NOT_LOADED);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!plan) return undefined;
    let current = true;
    Promise.all(plan.tiles.map((tile) => api.listSites(tile))).then(
      (results) => {
        if (current) setState({ ...plan.merge(results), loaded: true, plan, failedPlan: null });
      },
      (error: unknown) => {
        errors.report('sites', error);
        if (current) setState((previous) => ({ ...previous, failedPlan: plan }));
      },
    );
    return () => {
      current = false;
    };
  }, [api, errors, plan, version]);
  const refresh = useCallback(() => setVersion((count) => count + 1), []);
  const { sites, truncated, loaded } = state;
  const failed = plan !== null && state.failedPlan === plan;
  return { sites, truncated, loaded, failed, pending: plan !== null && state.plan !== plan && !failed, refresh };
}
