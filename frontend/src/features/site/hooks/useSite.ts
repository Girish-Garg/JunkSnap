import { useEffect, useState } from 'react';
import { useServices } from '../../../app/useServices';
import type { SiteFeature } from '../../../domain/Site';

export interface SiteState {
  readonly site: SiteFeature | null;
  readonly failed: boolean;
}

interface SiteResult extends SiteState {
  readonly siteId: string;
}

const LOADING: SiteState = { site: null, failed: false };

export function useSite(siteId: string): SiteState {
  const { api } = useServices();
  const [result, setResult] = useState<SiteResult | null>(null);
  useEffect(() => {
    let current = true;
    api.getSite(siteId).then(
      (site) => {
        if (current) setResult({ siteId, site, failed: false });
      },
      (error: unknown) => {
        console.error(`Could not load site ${siteId}`, error);
        if (current) setResult({ siteId, site: null, failed: true });
      },
    );
    return () => {
      current = false;
    };
  }, [api, siteId]);
  return result?.siteId === siteId ? result : LOADING;
}
