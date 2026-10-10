import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { SiteFeature } from '../../../domain/Site';

export interface SiteState {
  readonly site: SiteFeature | null;
  readonly failed: boolean;
  /** The api has no such site (404 not_found): gone from the map or a wrong link; trying again will not help. */
  readonly missing: boolean;
  /** Reads the site again, after a vote or a cleanup claim; the current one stays on screen meanwhile. */
  readonly reload: () => void;
}

interface SiteResult {
  readonly siteId: string;
  readonly site: SiteFeature | null;
  readonly failed: boolean;
  readonly missing: boolean;
}

const LOADING = { site: null, failed: false, missing: false } as const;

export function useSite(siteId: string): SiteState {
  const { api, errors } = useServices();
  const [result, setResult] = useState<SiteResult | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let current = true;
    api.getSite(siteId).then(
      (site) => {
        if (current) setResult({ siteId, site, failed: false, missing: false });
      },
      (error: unknown) => {
        const missing = errors.report('site', error).category === 'not_found';
        if (current) setResult((previous) => (previous?.siteId === siteId && previous.site ? previous : { siteId, site: null, failed: true, missing }));
      },
    );
    return () => {
      current = false;
    };
  }, [api, errors, siteId, version]);
  const reload = useCallback(() => setVersion((count) => count + 1), []);
  const loaded = result?.siteId === siteId ? result : LOADING;
  return { site: loaded.site, failed: loaded.failed, missing: loaded.missing, reload };
}
