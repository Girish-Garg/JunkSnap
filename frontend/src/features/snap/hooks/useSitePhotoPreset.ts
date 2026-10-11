import { useEffect, useState } from 'react';
import { useConfig } from '../../../app/useConfig';
import { useServices } from '../../../app/useServices';
import { SitePhotoPreset } from '../../../domain/SitePhotoPreset';
import { SiteClosure } from '../../site/SiteClosure';

/**
 * What /snap?site=… adds a photo to. none: no site in the address, an ordinary report. loading: no shutter yet, so no
 * photo can leave as a new report by mistake. closed: the site takes no new photo. failed: it could not be read.
 */
export type SitePhotoTarget =
  | { readonly kind: 'none' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly preset: SitePhotoPreset }
  | { readonly kind: 'closed' }
  | { readonly kind: 'failed' };

type Loaded = { readonly siteId: string; readonly target: SitePhotoTarget };

const NONE: SitePhotoTarget = { kind: 'none' };
const LOADING: SitePhotoTarget = { kind: 'loading' };

/** Reads the site from GET /sites/{id}: its type, context and point preset the photo; a closed or missing site stops it. */
export function useSitePhotoPreset(siteId: string | null): SitePhotoTarget {
  const { api } = useServices();
  const { site: rules } = useConfig();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (!siteId) return undefined;
    let current = true;
    api.getSite(siteId).then(
      (site) => {
        const closed = SiteClosure.reasonOf(site.properties) !== null;
        if (current) setLoaded({ siteId, target: closed ? { kind: 'closed' } : { kind: 'ready', preset: SitePhotoPreset.of(site, rules) } });
      },
      (error: unknown) => {
        console.error(`Could not load site ${siteId} for its photo`, error);
        if (current) setLoaded({ siteId, target: { kind: 'failed' } });
      },
    );
    return () => {
      current = false;
    };
  }, [api, siteId, rules]);
  if (!siteId) return NONE;
  return loaded?.siteId === siteId ? loaded.target : LOADING;
}
