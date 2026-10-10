import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sitePath } from '../../../app/paths';
import { useServices } from '../../../app/useServices';
import type { SiteFeature } from '../../../domain/Site';
import { NativeBridge } from '../../../services/NativeBridge';

const COPIED_MS = 2500;

/**
 * Shares the site's link on the stage's web app (VITE_WEB_URL, else this page's origin, which
 * inside the Android app is not a public address); `copied` is true briefly after a clipboard
 * fallback. Inside the Android app the native share sheet sends the title and the link.
 */
export function useShareSite(site: SiteFeature) {
  const { t } = useTranslation();
  const { config, sharer, errors, notifier } = useServices();
  const native = useMemo(() => new NativeBridge(window), []);
  const [copied, setCopied] = useState(false);
  const { site_id: siteId, report_type: type } = site.properties;
  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);
  const share = useCallback(() => {
    const url = `${config.webUrl ?? window.location.origin}${sitePath(siteId)}`;
    const title = t(`reportType.${type}`);
    const shared = native.canShareText()
      ? native.shareText(`${title} ${url}`).then(() => 'shared' as const, () => sharer.copy(url).then(() => 'copied' as const))
      : sharer.share(title, url);
    shared.then(
      (result) => setCopied(result === 'copied'),
      // Closing the share sheet is not a failure; anything else says so.
      (error: unknown) => {
        if (errors.report('share', error).category !== 'aborted') notifier.push({ key: 'actions.shareFailed', tone: 'alert' });
      },
    );
  }, [config, native, sharer, siteId, type, t, errors, notifier]);
  return { share, copied };
}
