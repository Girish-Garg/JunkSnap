import { useCallback, useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { SiteFeature } from '../../../domain/Site';

export interface SiteState {
  readonly site: SiteFeature | null;
  readonly failed: boolean;
  /** Reads the site again, after a vote or a cleanup claim; the current one stays on screen meanwhile. */
  readonly reload: () => void;
}

interface SiteResult {
  readonly siteId: string;
  readonly site: SiteFeature | null;
  readonly failed: boolean;
}

export function useSite(siteId: string): SiteState {
  const { api } = useServices();
  const [result, setResult] = useState<SiteResult | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let current = true;
    api.getSite(siteId).then(
      (site) => {
        if (current) setResult({ siteId, site, failed: false });
      },
      (error: unknown) => {
        console.error(`Could not load site ${siteId}`, error);
        if (current) setResult((previous) => (previous?.siteId === siteId && previous.site ? previous : { siteId, site: null, failed: true }));
      },
    );
    return () => {
      current = false;
    };
  }, [api, siteId, version]);
  const reload = useCallback(() => setVersion((count) => count + 1), []);
  const loaded = result?.siteId === siteId ? result : null;
  return { site: loaded?.site ?? null, failed: loaded?.failed ?? false, reload };
}
