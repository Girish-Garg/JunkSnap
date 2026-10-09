import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sitePath } from '../../../app/paths';
import { useServices } from '../../../app/useServices';
import type { SiteFeature } from '../../../domain/Site';

const COPIED_MS = 2500;

/** Shares the site's link; `copied` is true briefly after a clipboard fallback. */
export function useShareSite(site: SiteFeature) {
  const { t } = useTranslation();
  const { sharer } = useServices();
  const [copied, setCopied] = useState(false);
  const { site_id: siteId, report_type: type } = site.properties;
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const share = useCallback(() => {
    const url = `${window.location.origin}${sitePath(siteId)}`;
    sharer.share(t(`reportType.${type}`), url).then(
      (result) => setCopied(result === 'copied'),
      (error: unknown) => console.error('Could not share the site', error),
    );
  }, [sharer, siteId, type, t]);
  return { share, copied };
}
