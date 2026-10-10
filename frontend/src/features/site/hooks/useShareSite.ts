import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShareLinks } from '../../../app/useShareLinks';
import type { SiteFeature } from '../../../domain/Site';
import { useShareLink } from './useShareLink';

/**
 * Shares the site's link: in live mode the api's link preview (blurred photo, place and count for
 * WhatsApp, Telegram and X), which opens the site on the web app; in mock mode the web app page.
 * The Android app's own origin is not public, so it never shares that.
 */
export function useShareSite(site: SiteFeature) {
  const { t } = useTranslation();
  const links = useShareLinks();
  const { share: shareLink, copied } = useShareLink();
  const { site_id: siteId, report_type: type } = site.properties;
  const share = useCallback(() => shareLink(t(`reportType.${type}`), links.site(siteId)), [links, shareLink, siteId, type, t]);
  return { share, copied };
}
